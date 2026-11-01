export default async function handler(req, res) {
  // This code runs on Vercel's secure server, NEVER in the user's browser!
  const secretKey = process.env.EVE_CLIENT_SECRET; 

  res.status(200).json({
    message: "Backend server is online!",
    hasSecretConfigured: Boolean(secretKey)
  });
}