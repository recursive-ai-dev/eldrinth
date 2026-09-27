import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.resolve(__dirname, "../src/assets/portraits");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const STYLE_PREFIX = "masterpiece dark fantasy RPG character portrait, high quality digital oil painting, chest-up, three-quarter view facing slightly right toward viewer, dramatic moody lighting, dark atmospheric textured background, Elden Ring and Disco Elysium painterly aesthetic";

const CHARACTERS = [
  {
    id: "orithel-the-last-watcher",
    prompt: "pale teal glowing ethereal spirit projection of an ancient male watcher with severe ornate gold and ivory high collar, long drifting luminous white hair, pale glowing eyes, faint fractured Spire crystal halo shards floating above head, cold teal bioluminescent lighting from below, dark teal void background",
    seed: 101,
  },
  {
    id: "scribe-althea",
    prompt: "sharp-eyed female medieval archivist with an ochre hood, silver hair pinned by a white quill feather, ink-stained dark fingertips, clutching a cracked antique leather ledger to her chest, warm candle amber lighting, dark scholarly library background",
    seed: 102,
  },
  {
    id: "sister-mirene",
    prompt: "solemn priestess in a deep sea-green veil and habit, black-glass prayer beads at throat, linen bandages wrapped around hands with faint soft jade glowing light emanating through the cloth, soft jade green spiritual lighting, dark stone sanctuary background",
    seed: 103,
  },
  {
    id: "barris-the-smith",
    prompt: "broad weathered blacksmith with a cropped iron-grey beard and scarred rugged face, wearing a soot-stiff leather apron over dark tunic, carrying a broken sword hilt over one shoulder and smith hammer at belt, warm orange forge amber firelight, dark iron workshop background",
    seed: 104,
  },
  {
    id: "kiln-master-vance",
    prompt: "elderly male kiln tender wearing a hand-hammered copper half-mask covering half his face, glowing round ember-orange goggles, charcoal cloak dusted in pale furnace ash, holding a brass tally hook, deep orange kiln fire glow, smoky dark ash background",
    seed: 105,
  },
  {
    id: "cinder-nurse-greta",
    prompt: "practical female field medic with cropped dark curls under a singed white linen nurse cap, rust-red coat, yellow sulfur-stained heavy work gloves, carrying a cobalt blue glass water flask at hip, warm orange firelight with subtle blue accent, dark ash background",
    seed: 106,
  },
  {
    id: "elodie-outrunner",
    prompt: "wiry athletic young female scout with one side of temple shaved and dark hair, ash-grey scarf, patched red climbing coat, hooked wooden ravine staff in hand, charcoal map cylinder, volcanic ash haze and ember sparks lighting, rugged dark volcanic background",
    seed: 107,
  },
  {
    id: "mistress-morveth",
    prompt: "tough older female dredger in storm-water oilskin mantle, braided thick white hair, brass diving goggles pushed up on forehead, salvager cloth name-tags sewn into sleeves, cool blue-grey coastal sea light, dark stormy maritime background",
    seed: 108,
  },
  {
    id: "sister-lyra",
    prompt: "calm serene healer woman with shaved head, iridescent pearl ear cuffs, draped in layered kelp-green robes, holding a netted satchel of glowing glass salve jars, soft mint sea bioluminescence, dark oceanic background",
    seed: 109,
  },
  {
    id: "kieran-blind-oar",
    prompt: "weathered blind elderly ferryman with clouded milky eyes and deep wrinkles, wearing a salt-bleached navy blue coat, thick rope coil slung across chest, holding a long carved wooden oar staff, pale cool moonlight, dark mist sea background",
    seed: 110,
  },
  {
    id: "reeve-toran",
    prompt: "gaunt scholarly male astronomer in a deep violet wool mantle, wearing a cracked brass monocle over one eye, wind-tossed messy black hair, cradling a polished brass telescope lens under his arm, ethereal lavender starlight glow, dark midnight sky background",
    seed: 111,
  },
  {
    id: "hermit-cassian",
    prompt: "soft-spoken elderly hermit with a close-trimmed silver beard in a plum hooded coat, green celestial moss tucked into his cuffs, holding a rough dark meteorite bowl filled with glowing violet spring water, muted violet celestial lighting, dark cavern background",
    seed: 112,
  },
  {
    id: "mina-drift-child",
    prompt: "slight mystical young girl in an oversized charcoal cloak embroidered with sparkling meteor-glass beads, pale braided hair, wide ink-dark eyes, bronze tuning fork hanging from a cord around her neck, lavender starlight with silver sparks, dark starry void background",
    seed: 113,
  },
];

async function downloadPortrait(char, attempt = 1) {
  const fullPrompt = `${STYLE_PREFIX}, ${char.prompt}`;
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=512&height=512&seed=${char.seed}&nologo=true`;
  const targetPath = path.join(OUTPUT_DIR, `${char.id}.jpg`);

  console.log(`[${char.id}] Fetching portrait (attempt ${attempt})...`);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    let res;
    try {
      res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Eldrinth-Portrait-Pipeline/1.0",
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 1000) {
      throw new Error(`Image payload too small (${buffer.length} bytes)`);
    }

    fs.writeFileSync(targetPath, buffer);
    console.log(`[${char.id}] Saved ${buffer.length} bytes to ${targetPath}`);
    return true;
  } catch (err) {
    console.error(`[${char.id}] Error on attempt ${attempt}:`, err.message);
    if (attempt < 3) {
      console.log(`[${char.id}] Retrying in 2 seconds...`);
      await new Promise((r) => setTimeout(r, 2000));
      return downloadPortrait(char, attempt + 1);
    }
    throw err;
  }
}

async function main() {
  console.log(`Starting portrait generation for ${CHARACTERS.length} characters...`);
  const results = [];

  for (const char of CHARACTERS) {
    try {
      await downloadPortrait(char);
      results.push({ id: char.id, success: true });
    } catch (err) {
      results.push({ id: char.id, success: false, error: err.message });
    }
  }

  console.log("\n--- Generation Summary ---");
  let failed = 0;
  for (const r of results) {
    if (r.success) {
      console.log(`✓ ${r.id}`);
    } else {
      console.log(`✗ ${r.id}: ${r.error}`);
      failed++;
    }
  }

  if (failed > 0) {
    console.error(`\nFailed to generate ${failed} portraits.`);
    process.exitCode = 1;
  } else {
    console.log(`\nSuccessfully generated all ${CHARACTERS.length} character portraits!`);
  }
}

main().catch((error) => {
  console.error("Portrait generation failed:", error);
  process.exitCode = 1;
});
