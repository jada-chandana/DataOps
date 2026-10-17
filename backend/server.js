import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import ProfileRoutes from "./routes/ProfileRoutes.js"
dotenv.config();
const app=express();
const PORT=process.env.port||5000;

app.use(cors())
app.use(express.json())
app.use("/api/profile", ProfileRoutes);
app.get("/",(req,res)=>{
res.json=({
message:"welcome to dataops",
status:"running"
})
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "DataOps One backend is healthy",
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT,()=>{
    console.log(`DataOps One API running at http://localhost:${PORT}`)
})