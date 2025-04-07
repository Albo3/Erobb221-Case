import bcrypt from 'bcrypt';

// --- Configuration ---
const plainPassword = 'caseAdmin!'; // The password you want to hash
const saltRounds = 10; // Standard bcrypt salt rounds
// --- ---

async function generateHash() {
  console.log(`Generating bcrypt hash for password: "${plainPassword}" with ${saltRounds} salt rounds...`);
  try {
    const hash = await bcrypt.hash(plainPassword, saltRounds);
    console.log("\n--- HASH GENERATED ---");
    console.log(`Password: ${plainPassword}`);
    console.log(`BCrypt Hash (salt=${saltRounds}): ${hash}`);
    console.log("----------------------\n");
    console.log("ACTION REQUIRED:");
    console.log("1. Copy the generated BCrypt Hash above.");
    console.log("2. Open 'server/index.ts'.");
    console.log("3. Find the line defining 'ADMIN_PASSWORD_HASH'.");
    console.log("4. Replace the existing placeholder hash (the long string starting with '$2b$...') with the hash you just copied.");
    console.log("   OR (Better Practice): Set an environment variable named ADMIN_PASSWORD_HASH with this value when running the server.");
    console.log("5. Save 'server/index.ts' and restart your development server ('bun run dev').");
  } catch (err) {
    console.error("\n--- ERROR ---");
    console.error("Error generating hash:", err);
    console.error("-------------");
  }
}

generateHash();
