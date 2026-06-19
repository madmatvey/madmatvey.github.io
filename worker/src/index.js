const SITE = "https://eugenetheengineer.com";
const MAX_HTML_BYTES = 2_097_152;

import { buildSkillsIndex, getSkillByPath } from "./skills.js";

const LINK_HEADER = [
  `<${SITE}/.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"`,
  `<${SITE}/.well-known/agent-skills/index.json>; rel="describedby"; type="application/json"`,
  `<${SITE}/feed.xml>; rel="alternate"; type="application/atom+xml"`,
].join(", ");

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/.well-known/api-catalog") {
      return apiCatalog();
    }

    if (path === "/.well-known/agent-skills/index.json") {
      return skillsIndexResponse();
    }

    const skill = getSkillByPath(path);
    if (skill) {
      return skillResponse(skill);
    }

    if (/text\/markdown/i.test(request.headers.get("Accept") || "")) {
      return toMarkdown(request, env);
    }

    return passthroughWithLinkHeader(request);
  },
};

async function passthroughWithLinkHeader(request) {
  const resp = await fetch(request);
  const ct = resp.headers.get("content-type") || "";
  if (!ct.includes("text/html")) {
    return resp;
  }

  const headers = new Headers(resp.headers);
  headers.append("Link", LINK_HEADER);
  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers,
  });
}

async function toMarkdown(request, env) {
  const htmlReq = new Request(request, { headers: new Headers(request.headers) });
  htmlReq.headers.set("Accept", "text/html");

  const resp = await fetch(htmlReq);
  const ct = resp.headers.get("content-type") || "";
  if (!resp.ok || !ct.includes("text/html")) {
    return resp;
  }

  const html = await resp.text();
  if (html.length > MAX_HTML_BYTES) {
    return resp;
  }

  const out = await env.AI.toMarkdown([
    { name: "page.html", blob: new Blob([html], { type: "text/html" }) },
  ]);

  const headers = new Headers({
    "content-type": "text/markdown; charset=utf-8",
    vary: "Accept",
    "cache-control": "public, max-age=3600",
    link: LINK_HEADER,
  });

  if (out[0]?.tokens != null) {
    headers.set("x-markdown-tokens", String(out[0].tokens));
  }

  return new Response(out[0]?.data ?? "", { status: 200, headers });
}

function apiCatalog() {
  const body = {
    linkset: [
      {
        anchor: `${SITE}/`,
        "service-doc": [
          {
            href: `${SITE}/`,
            title: "Eugene the Engineer — blog",
          },
        ],
        describedby: [
          {
            href: `${SITE}/.well-known/agent-skills/index.json`,
            type: "application/json",
          },
        ],
        alternate: [
          {
            href: `${SITE}/feed.xml`,
            type: "application/atom+xml",
            title: "RSS/Atom feed",
          },
          {
            href: `${SITE}/sitemap.xml`,
            type: "application/xml",
            title: "Sitemap",
          },
        ],
      },
    ],
  };

  return jsonResponse(body, "application/linkset+json; charset=utf-8");
}

async function skillsIndexResponse() {
  const body = await buildSkillsIndex(SITE);
  return jsonResponse(body, "application/json; charset=utf-8");
}

function skillResponse(skill) {
  return new Response(skill.body, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}

function jsonResponse(body, contentType) {
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=3600",
    },
  });
}
