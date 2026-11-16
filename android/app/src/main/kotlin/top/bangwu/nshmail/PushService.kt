package top.bangwu.nshmail

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * The server's FCM data messages (`crates/server/src/push.rs`): `{type, id, source?, account?, from?, subject?, link?}`,
 * where `type` is `newMail` for a mail account and `notification` for every other source, and everything after
 * `id` is missing when the user hides content. Each shows as the app's own notification would
 * (`app/resident.ts`): the tag's prefix makes the app's `Notifications` listener open the mail message or the
 * feed's notification.
 */
class PushService : FirebaseMessagingService() {
    override fun onNewToken(token: String) = PushToken.refreshed(token)

    override fun onMessageReceived(message: RemoteMessage) {
        val data = message.data
        val id = data["id"] ?: return
        val prefix = when (data["type"]) {
            "newMail" -> MESSAGE_PREFIX
            "notification" -> NOTIFICATION_PREFIX
            else -> return
        }
        val fallback = if (prefix == MESSAGE_PREFIX) R.string.new_mail else R.string.new_notification
        val title = data["from"] ?: data["source"] ?: getString(fallback)
        show(this, "$prefix$id", title, data["subject"].orEmpty())
    }

    private companion object {
        const val TAG = "AgentInbox"
        const val MESSAGE_PREFIX = "message:"
        const val NOTIFICATION_PREFIX = "notification:"

        // nsh 0.5's Notifications (NshView.handleNotificationIntent reads EXTRA): the same channel, tag, id and
        // launch extra make a pushed notification one of the app's own.
        const val CHANNEL = "com.longbridge.nsh.notifications"
        const val EXTRA = "com.longbridge.nsh.NOTIFICATION"
        const val NOTIFICATION_ID = 1

        fun show(context: Context, tag: String, title: String, body: String) {
            val manager = context.getSystemService(NotificationManager::class.java)
            if (manager.getNotificationChannel(CHANNEL) == null) {
                val channel = NotificationChannel(CHANNEL, context.getString(R.string.notifications), NotificationManager.IMPORTANCE_HIGH)
                channel.setShowBadge(true)
                manager.createNotificationChannel(channel)
            }
            val builder = Notification.Builder(context, CHANNEL)
                .setSmallIcon(android.R.drawable.sym_action_email)
                .setContentTitle(title)
                .setAutoCancel(true)
                .setShowWhen(true)
            if (body.isNotEmpty()) builder.setContentText(body)
            context.packageManager.getLaunchIntentForPackage(context.packageName)?.let { launch ->
                launch.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
                launch.putExtra(EXTRA, tag)
                builder.setContentIntent(
                    PendingIntent.getActivity(context, tag.hashCode(), launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE),
                )
            }
            try {
                manager.notify(tag, NOTIFICATION_ID, builder.build())
            } catch (e: RuntimeException) {
                Log.w(TAG, "cannot show a notification", e)
            }
        }
    }
}

/** Hands the FCM token to the running app. Main thread. */
object PushToken {
    private var listener: ((String) -> Unit)? = null

    /** Gets the current token, then each new one until [stop]. */
    fun listen(context: Context, listener: (String) -> Unit) {
        this.listener = listener
        if (FirebaseApp.getApps(context).isEmpty()) {
            Log.i("AgentInbox", "no Firebase config (android/app/google-services.json): push is off")
            return
        }
        FirebaseMessaging.getInstance().token
            .addOnSuccessListener { token -> this.listener?.invoke(token) }
            .addOnFailureListener { e -> Log.w("AgentInbox", "no FCM token", e) }
    }

    fun stop(listener: (String) -> Unit) {
        if (this.listener === listener) this.listener = null
    }

    fun refreshed(token: String) {
        Handler(Looper.getMainLooper()).post { listener?.invoke(token) }
    }
}
