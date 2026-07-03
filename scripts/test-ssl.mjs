import https from "https";

const url = "https://hnsitcenter.id/wp-content/uploads/2026/06/1BID.png";

https.get(url, (res) => {
  console.log("Status:", res.statusCode);
}).on("error", (e) => {
  console.log("Error:", e.message);
});
