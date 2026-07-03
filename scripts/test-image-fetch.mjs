import https from "https";

const url = "https://hnsitcenter.id/wp-content/uploads/2026/06/1BID.png";

https.get(url, { rejectUnauthorized: false }, (res) => {
  console.log("Status:", res.statusCode);
  console.log("Headers:", res.headers);
}).on("error", (e) => {
  console.log("Error:", e);
});
