import { supabase } from "@/utils/supabase";

const BASE_URL = process.env.EXPO_PUBLIC_CASSANDRA_API_URL;

export interface StreamChatOptions {
  photoUrl?: string;
  propertyId?: string;
}

export function streamChat(
  message: string,
  sessionId: string,
  onToken: (token: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
  signal?: AbortSignal,
  options?: StreamChatOptions
) {
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!session?.access_token) {
      onError("Please sign in again.");
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE_URL}/chat`);
    xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
    xhr.setRequestHeader("Content-Type", "application/json");

    let cursor = 0;

    xhr.onreadystatechange = () => {
      if (
        xhr.readyState === XMLHttpRequest.LOADING ||
        xhr.readyState === XMLHttpRequest.DONE
      ) {
        const newChunk = xhr.responseText.slice(cursor);
        cursor = xhr.responseText.length;

        for (const line of newChunk.split("\n\n")) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data: ")) {
            const data = trimmed.replace("data: ", "");
            if (data === "[DONE]") {
              onDone();
            } else if (data) {
              onToken(data);
            }
          }
        }
      }
    };

    xhr.onerror = () => onError("Cannot reach Cassandra.");
    xhr.ontimeout = () => onError("Request timed out.");
    xhr.timeout = 30000;

    signal?.addEventListener("abort", () => xhr.abort());

    const body: Record<string, unknown> = { message, session_id: sessionId };
    if (options?.photoUrl) body.photo_url = options.photoUrl;
    if (options?.propertyId) body.property_id = options.propertyId;

    xhr.send(JSON.stringify(body));
  });
}
