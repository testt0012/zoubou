import test from "node:test";
import assert from "node:assert/strict";
import { isPushServiceEndpoint } from "@/lib/push/endpoint";

test("only real browser push services are accepted as a subscription address", () => {
  assert.ok(isPushServiceEndpoint("https://fcm.googleapis.com/fcm/send/abc"));
  assert.ok(isPushServiceEndpoint("https://web.push.apple.com/QXYZ"));
  assert.ok(isPushServiceEndpoint("https://updates.push.services.mozilla.com/wpush/v2/abc"));
  assert.ok(isPushServiceEndpoint("https://wns2-par02p.notify.windows.com/w/?token=abc"));

  assert.equal(isPushServiceEndpoint("http://fcm.googleapis.com/x"), false);
  assert.equal(isPushServiceEndpoint("https://evil.example.com/x"), false);
  assert.equal(isPushServiceEndpoint("https://googleapis.com.evil.example/x"), false);
  assert.equal(isPushServiceEndpoint("https://fcm.googleapis.com:8443/x"), false);
  assert.equal(isPushServiceEndpoint("https://user:pw@fcm.googleapis.com/x"), false);
  assert.equal(isPushServiceEndpoint("https://169.254.169.254/latest"), false);
  assert.equal(isPushServiceEndpoint("not a url"), false);
});
