// A test's own process has no network stack, so a real request in `.e2e/cloud.test.tsx` goes
// through an app's: this one makes the request its storage names and shows the answer. It is a
// test fixture, never part of the product.
//
// `hook.request` is `{ method, url, headers?, body? }`; the screen shows the status and the body
// under `testID="hook-answer"`, so the test can read what the server answered.
import { mount, signal, Storage, Text, View } from "nsh";

function App() {
  const answer = signal("waiting");
  const send = async () => {
    try {
      const raw = (await Storage.getItem("hook.request")) ?? "{}";
      const request = JSON.parse(raw) as { method?: string; url: string; headers?: Record<string, string>; body?: string };
      const response = await fetch(request.url, {
        method: request.method ?? "GET",
        headers: request.headers ?? {},
        body: request.body,
      });
      answer.set(`status ${response.status}\n${await response.text()}`);
    } catch (e) {
      answer.set(`error ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  void send();
  return (
    <View class="flex-1 p-4">
      <Text testID="hook-answer">{answer()}</Text>
    </View>
  );
}

mount(App);
