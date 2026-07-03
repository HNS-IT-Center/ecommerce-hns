import https from "https";

const wooUrl = process.env.WOOCOMMERCE_URL || "https://hnsitcenter.id";
const consumerKey = process.env.WOOCOMMERCE_CONSUMER_KEY || "ck_c1bdd723d901c212884009666e91a205a8013708";
const consumerSecret = process.env.WOOCOMMERCE_CONSUMER_SECRET || "cs_ea701ee059191133a4505294d92ad13a03e75af4";

const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");

https.get(`${wooUrl}/wp-json/wc/v3/products?search=CARD%20READER`, {
  headers: {
    Authorization: `Basic ${auth}`
  }
}, (res) => {
  let data = "";
  res.on("data", (chunk) => data += chunk);
  res.on("end", () => {
    try {
      const products = JSON.parse(data);
      if (Array.isArray(products) && products.length > 0) {
        products.forEach(p => {
          console.log(p.name);
          if (p.images && p.images.length > 0) {
            console.log(p.images[0].src);
          } else {
            console.log("No images");
          }
        });
      } else {
        console.log("No products or not array:", products);
      }
    } catch (e) {
      console.log("Error parsing:", e);
    }
  });
}).on("error", (e) => {
  console.log("Req error:", e);
});
