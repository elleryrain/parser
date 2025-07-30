import { config } from "dotenv";

config();

export const groupUrl = String(process.env.GROUP_URL);
console.log("group url", groupUrl);
