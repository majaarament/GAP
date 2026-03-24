const ENDPOINT = import.meta.env.VITE_API_BASE_URL;

/**
 * Sends one answer row to the Google Sheets Apps Script endpoint.
 * Uses Content-Type: text/plain so the script receives data via e.postData.contents.
 */
export async function saveResponseToSheets({
  user_id = "prototype-user",
  question_id,
  answer,
  session_id = "",
  scene_name = "",
  country_or_tenant = "NL",
  completion_status = "answered",
}) {
  if (!ENDPOINT || !ENDPOINT.startsWith("https://")) throw new Error("Sheets endpoint not configured");

  const payload = {
    user_id,
    question_id,
    answer,
    timestamp: new Date().toISOString(),
    session_id,
    scene_name,
    country_or_tenant,
    completion_status,
  };

  await fetch(ENDPOINT, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
}
