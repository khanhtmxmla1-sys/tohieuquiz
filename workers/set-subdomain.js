const token = process.env.CLOUDFLARE_API_TOKEN;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

if (!token || !accountId) {
    throw new Error('Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID before running this script.');
}

fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/subdomain`, {
    method: 'PUT',
    headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({ subdomain: 'tohieuquiz-master' }),
})
    .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(`Cloudflare subdomain update failed with status ${response.status}.`);
        }
        process.stdout.write('Cloudflare Workers subdomain updated successfully.\n');
    })
    .catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    });
