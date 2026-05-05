const token = process.env.CLOUDFLARE_API_TOKEN;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const projectName = process.env.CLOUDFLARE_PAGES_PROJECT || "medical-essentials";
const domains = (process.env.CLOUDFLARE_PAGES_DOMAINS || "masteringessentials.com,www.masteringessentials.com")
  .split(",")
  .map((domain) => domain.trim())
  .filter(Boolean);

if (!token || !accountId) {
  console.error("Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID.");
  process.exit(1);
}

async function cloudflare(path, options = {}) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const payload = await response.json();

  if (!response.ok || payload.success === false) {
    const message = payload.errors?.map((error) => error.message).join("; ") || response.statusText;
    throw new Error(message);
  }

  return payload.result;
}

for (const domain of domains) {
  try {
    await cloudflare(`/accounts/${accountId}/pages/projects/${projectName}/domains`, {
      method: "POST",
      body: JSON.stringify({ name: domain })
    });
    console.log(`Added Cloudflare Pages custom domain: ${domain}`);
  } catch (error) {
    if (String(error.message).toLowerCase().includes("already")) {
      console.log(`Cloudflare Pages custom domain already exists: ${domain}`);
      continue;
    }

    throw error;
  }
}
