import markdownNegotiationSkill from "./skills/markdown-negotiation/SKILL.md";

const SKILLS = [
  {
    name: "markdown-negotiation",
    type: "capability",
    description:
      "Pages are available as Markdown via the Accept: text/markdown header.",
    path: "/.well-known/agent-skills/markdown-negotiation/SKILL.md",
    body: markdownNegotiationSkill,
  },
];

let skillsIndexCache = null;

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function buildSkillsIndex(site) {
  if (skillsIndexCache) return skillsIndexCache;

  const skills = await Promise.all(
    SKILLS.map(async (skill) => ({
      name: skill.name,
      type: skill.type,
      description: skill.description,
      url: `${site}${skill.path}`,
      digest: `sha256:${await sha256Hex(skill.body)}`,
    })),
  );

  skillsIndexCache = {
    $schema: "https://agentskills.io/schema/v0.2.0/index.json",
    skills,
  };

  return skillsIndexCache;
}

export function getSkillByPath(pathname) {
  return SKILLS.find((skill) => skill.path === pathname) ?? null;
}
