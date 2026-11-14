use std::{env, net::SocketAddr, path::PathBuf};

use anyhow::{Context, Result, bail};
use base64::{Engine as _, engine::general_purpose::STANDARD};
use mail_core::{OAuthApp, OAuthApps};

#[derive(Clone)]
pub struct Config {
    pub bind: SocketAddr,
    pub data_dir: PathBuf,
    pub public_url: String,
    pub master_key: [u8; 32],
    /// The previous master key while rotating: secrets still under it are re-encrypted at start.
    pub master_key_old: Option<[u8; 32]>,
    pub web_dir: Option<PathBuf>,
    pub cors_origins: Vec<String>,
    pub allow_signup: bool,
    /// Confidential web clients; mail-core also uses them to refresh tokens.
    pub oauth: OAuthApps,
    pub fcm_service_account: Option<PathBuf>,
    /// Overridable so tests can point FCM at a local mock.
    pub fcm_base_url: String,
    pub vapid_private_key: Option<String>,
    pub vapid_subject: String,
    /// The most a message's attachments may add up to, in bytes.
    pub max_attachments: u64,
}

/// A setting's value. Settings are `AGENTINBOX_*`; the old `NSHMAIL_*` names stay aliases, so an
/// existing deployment's `.env` keeps working after the rename.
pub fn var(name: &str) -> Option<String> {
    read(name).or_else(|| {
        name.strip_prefix("AGENTINBOX_")
            .and_then(|rest| read(&format!("NSHMAIL_{rest}")))
    })
}

fn read(name: &str) -> Option<String> {
    env::var(name)
        .ok()
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

/// Both spellings of a setting, for errors, so an operator with the old name knows it applies.
fn names(name: &str) -> String {
    match name.strip_prefix("AGENTINBOX_") {
        Some(rest) => format!("{name} (or NSHMAIL_{rest})"),
        None => name.to_string(),
    }
}

/// Errors never carry the decoder's message: it quotes bytes of the key.
pub fn parse_master_key(name: &str, value: &str) -> Result<[u8; 32]> {
    let bytes = STANDARD
        .decode(value.trim())
        .map_err(|_| anyhow::anyhow!("{name} is not valid base64"))?;
    bytes.try_into().map_err(|_| {
        anyhow::anyhow!(
            "{name} must decode to exactly 32 bytes (generate one with `openssl rand -base64 32`)"
        )
    })
}

fn oauth_app(id: &str, secret: &str) -> Result<Option<OAuthApp>> {
    match (var(id), var(secret)) {
        (Some(client_id), Some(secret)) => Ok(Some(OAuthApp {
            client_id,
            client_secret: Some(secret),
        })),
        (None, None) => Ok(None),
        _ => bail!("set both {} and {}, or neither", names(id), names(secret)),
    }
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let Some(key) = var("AGENTINBOX_MASTER_KEY") else {
            bail!(
                "{} is not set. It encrypts stored mail credentials; \
                 generate one with `openssl rand -base64 32`, keep it outside the data directory, \
                 and rotate it only through {} (see the deployment guide)",
                names("AGENTINBOX_MASTER_KEY"),
                names("AGENTINBOX_MASTER_KEY_OLD")
            );
        };
        let bind = var("AGENTINBOX_BIND")
            .unwrap_or_else(|| "0.0.0.0:8080".into())
            .parse()
            .with_context(|| {
                format!(
                    "{} must be host:port, e.g. 0.0.0.0:8080",
                    names("AGENTINBOX_BIND")
                )
            })?;
        let public_url = var("AGENTINBOX_PUBLIC_URL")
            .unwrap_or_else(|| "http://localhost:8080".into())
            .trim_end_matches('/')
            .to_string();
        let allow_signup = match var("AGENTINBOX_ALLOW_SIGNUP").as_deref() {
            None | Some("true" | "1") => true,
            Some("false" | "0") => false,
            Some(other) => bail!(
                "{} must be true or false, got {other:?}",
                names("AGENTINBOX_ALLOW_SIGNUP")
            ),
        };
        let max_attachments = match var("AGENTINBOX_MAX_ATTACHMENTS_MB") {
            None => mail_core::types::MAX_ATTACHMENTS,
            Some(mb) => match mb.parse::<u64>() {
                Ok(mb) if (1..=1024).contains(&mb) => mb * 1024 * 1024,
                _ => bail!(
                    "{} must be a whole number of MB from 1 to 1024, got {mb:?}",
                    names("AGENTINBOX_MAX_ATTACHMENTS_MB")
                ),
            },
        };
        Ok(Config {
            max_attachments,
            bind,
            data_dir: var("AGENTINBOX_DATA_DIR")
                .unwrap_or_else(|| "data".into())
                .into(),
            master_key: parse_master_key(&names("AGENTINBOX_MASTER_KEY"), &key)?,
            master_key_old: var("AGENTINBOX_MASTER_KEY_OLD")
                .map(|k| parse_master_key(&names("AGENTINBOX_MASTER_KEY_OLD"), &k))
                .transpose()?,
            web_dir: var("AGENTINBOX_WEB_DIR").map(PathBuf::from),
            cors_origins: var("AGENTINBOX_CORS_ORIGINS")
                .map(|v| {
                    v.split(',')
                        .map(|s| s.trim().to_string())
                        .filter(|s| !s.is_empty())
                        .collect()
                })
                .unwrap_or_default(),
            allow_signup,
            oauth: OAuthApps {
                google: oauth_app(
                    "AGENTINBOX_GOOGLE_CLIENT_ID",
                    "AGENTINBOX_GOOGLE_CLIENT_SECRET",
                )?,
                microsoft: oauth_app("AGENTINBOX_MS_CLIENT_ID", "AGENTINBOX_MS_CLIENT_SECRET")?,
            },
            fcm_service_account: var("AGENTINBOX_FCM_SERVICE_ACCOUNT").map(PathBuf::from),
            fcm_base_url: "https://fcm.googleapis.com".into(),
            vapid_private_key: var("AGENTINBOX_VAPID_PRIVATE_KEY"),
            vapid_subject: var("AGENTINBOX_VAPID_SUBJECT").unwrap_or_else(|| public_url.clone()),
            public_url,
        })
    }
}
