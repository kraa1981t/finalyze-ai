import { spawnSync } from 'child_process';
import path from 'path';

const projectId = "gen-lang-client-0856831678";
const newDomain = "finalyze-ai-sigma.vercel.app";

async function run() {
  console.log("\n=======================================================");
  console.log("   🚀 FIREBASE AUTOMATED DOMAIN WHITELISTER");
  console.log("=======================================================\n");
  
  console.log("Step 1: Authenticating your machine with Firebase...");
  console.log("👉 A browser tab will open shortly. Please select your Google account");
  console.log("   (the one you used to create your Gemini API Key) and click 'Allow'.\n");
  
  // Find local firebase executable path
  const firebaseBin = path.resolve("node_modules/firebase-tools/lib/bin/firebase.js");
  
  // Run login
  const loginRes = spawnSync("node", [firebaseBin, "login"], { stdio: "inherit" });
  
  if (loginRes.status !== 0) {
    console.error("\n❌ Firebase login failed. Please retry or ensure your browser is open.");
    process.exit(1);
  }
  
  console.log("\nStep 2: Fetching your current Firebase Auth configuration...");
  const fetchRes = spawnSync("node", [firebaseBin, "api:call", "GET", `/v2/projects/${projectId}/config`], { encoding: 'utf8' });
  
  if (fetchRes.status !== 0) {
    console.error("\n❌ Failed to fetch current Firebase config.");
    console.error(fetchRes.error || fetchRes.stderr);
    process.exit(1);
  }
  
  let currentConfig;
  try {
    currentConfig = JSON.parse(fetchRes.stdout);
  } catch (err) {
    console.error("\n❌ Failed to parse configuration data:", err.message);
    console.error("Raw response:", fetchRes.stdout);
    process.exit(1);
  }
  
  const domains = currentConfig.authorizedDomains || [];
  console.log("\nCurrent whitelisted domains:", domains);
  
  if (domains.includes(newDomain)) {
    console.log(`\n🎉 Success! The domain "${newDomain}" is ALREADY whitelisted in your Firebase settings!`);
    process.exit(0);
  }
  
  // Add new domain
  domains.push(newDomain);
  console.log(`Adding "${newDomain}" to the list...`);
  
  console.log("\nStep 3: Uploading updated configuration to Google Firebase servers...");
  const patchData = JSON.stringify({ authorizedDomains: domains });
  
  // Run PATCH request using spawnSync (safe from Windows shell quote escaping issues)
  const updateRes = spawnSync("node", [
    firebaseBin,
    "api:call",
    "PATCH",
    `/v2/projects/${projectId}/config?updateMask=authorizedDomains`,
    "--data",
    patchData
  ], { encoding: 'utf8' });
  
  if (updateRes.status !== 0) {
    console.error("\n❌ Failed to update Firebase config:", updateRes.error || updateRes.stderr);
    process.exit(1);
  }
  
  console.log("\n=======================================================");
  console.log("   🎉 SUCCESS! DOMAIN WHITELISTED SUCCESSFULLY!");
  console.log("=======================================================");
  console.log(`\nYour website "${newDomain}" is now fully authorized.`);
  console.log("Google Sign-In will work perfectly for all users immediately!");
  console.log("\nYou can close this window now.\n");
}

run();
