import { handleGoogleNotification } from "@/lib/google/watch";

// Notificacions push de Google Calendar: només invaliden la memòria cau d'ocupació.
export async function POST(req: Request) {
  const ok = await handleGoogleNotification({
    channelId: req.headers.get("x-goog-channel-id"),
    token: req.headers.get("x-goog-channel-token"),
    resourceState: req.headers.get("x-goog-resource-state"),
  });
  return new Response(null, { status: ok ? 200 : 404 });
}
