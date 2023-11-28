const axios = require("axios");
require("dotenv").config();

const apiUrl = "https://api.ngrok.com/tunnels";
const ngrok_apiKey = process.env.NGROK_API_KEY;
const cloudflare_apiKey = process.env.CLOUDFLARE_API_KEY;
const cloudflare_zoneID = process.env.CLOUDFLARE_ZONE_ID;

axios
  .get(apiUrl, {
    headers: {
      Authorization: `Bearer ${ngrok_apiKey}`,
      "Ngrok-Version": "2",
    },
  })
  .then((response) => {
    // Get the tunnel data from ngrok api
    bhayanak_minecraft_url = "";

    response.data.tunnels.forEach((tunnel) => {
      if (tunnel.forwards_to === "bhayanak_minecraft:25565")
        bhayanak_minecraft_url = tunnel.public_url;
    });

    return bhayanak_minecraft_url.replace("tcp://", "");
  })
  .then(async (ngrok_url) => {
    // get cloudflare dns record
    const apiUrl = `https://api.cloudflare.com/client/v4/zones/${cloudflare_zoneID}/dns_records`;

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cloudflare_apiKey}`,
    };

    response = await axios.get(apiUrl, { headers });

    if (!response.data.success && response.data.errors.length > 0)
      throw new Error("Failed in getting DNS records from Cloudflare");

    mc_dns_record = null;

    response.data.result.forEach((record) => {
      if (record.comment === "point to minecraft server ip")
        mc_dns_record = record;
    });

    if (!mc_dns_record)
      throw new Error(
        "Could not retrieve minecraft DNS record from Cloudflare"
      );

    return {
      apiUrl,
      headers,
      old_dns_record: mc_dns_record,
      ngrok_url: ngrok_url,
    };
  })
  .then(({ apiUrl, headers, old_dns_record, ngrok_url }) => {
    const [ngrok_ip, ngrok_port] = ngrok_url.split(":");

    console.log("ngrok new ip:", ngrok_ip, ngrok_port);

    const new_dns_record = {
      type: "SRV",
      name: "_minecraft._tcp.mc.bhayanak.net",
      comment: "point to minecraft server ip",
      data: {
        name: "mc.bhayanak.net",
        port: ngrok_port,
        priority: 0,
        proto: "_tcp",
        service: "_minecraft",
        target: ngrok_ip,
        weight: 0,
      },
    };

    axios
      .put(apiUrl + `/${old_dns_record.id}`, new_dns_record, {
        headers,
      })
      .then((response) =>
        console.log("DNS record updated successfully:", response.data.result)
      )
      .catch((error) => {
        console.log(error);
        console.error("Error updating DNS record:", error.response.data.errors);
      });
  })
  .catch((error) => {
    // Handle errors
    console.error(error);
  });
