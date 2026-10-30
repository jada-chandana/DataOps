import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import ProfileRoutes from "./routes/ProfileRoutes.js"
import ValidationRoutes from "./routes/validationRoutes.js";
import CleaningRoutes from "./routes/cleaningRoutes.js";
import ETLRoutes from "./routes/etlRoutes.js"
dotenv.config();
const app=express();
const PORT=process.env.port||5000;

app.use(cors())
app.use(express.json())
app.use("/api/profile", ProfileRoutes);
app.use("/api/validation", ValidationRoutes);
app.use("/api/cleaning",CleaningRoutes);
app.use("/api/etl", ETLRoutes);
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