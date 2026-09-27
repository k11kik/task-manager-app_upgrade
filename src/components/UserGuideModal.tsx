import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  BookOpen,
  X,
  Search,
  ExternalLink,
  Download,
  FileText,
  ChevronRight,
  List,
  Globe
} from 'lucide-react';
import readmeJaRaw from '../../README.md?raw';
import readmeEnRaw from '../../README.en.md?raw';
import readmeFrRaw from '../../README.fr.md?raw';
import { cn, tr } from '../lib/utils';

export type GuideLanguage = 'ja' | 'en' | 'fr';

export interface GuideSection {
  id: string;
  title: string;
  level: number;
  rawLines: string[];
}

export function normalizeGuideLang(lang?: string): GuideLanguage {
  if (lang === 'en' || lang === 'fr' || lang === 'ja') return lang;
  return 'ja';
}

export function getReadmeMarkdownByLang(lang?: string): string {
  const normalized = normalizeGuideLang(lang);
  if (normalized === 'en') return readmeEnRaw;
  if (normalized === 'fr') return readmeFrRaw;
  return readmeJaRaw;
}

export function getReadmeFilenameByLang(lang?: string): string {
  const normalized = normalizeGuideLang(lang);
  if (normalized === 'en') return 'README.en.md';
  if (normalized === 'fr') return 'README.fr.md';
  return 'README.md';
}

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/[^\w\u00C0-\u024F\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export function parseMarkdownSections(md: string): {
  title: string;
  introLines: string[];
  sections: GuideSection[];
} {
  const lines = md.split(/\r?\n/);
  let title = 'NavFOR User Guide';
  const introLines: string[] = [];
  const sections: GuideSection[] = [];
  let currentSection: GuideSection | null = null;

  for (const line of lines) {
    const h1Match = line.match(/^#\s+(.+)$/);
    if (h1Match && sections.length === 0 && !currentSection) {
      title = h1Match[1].trim();
      continue;
    }

    const h2Match = line.match(/^##\s+(.+)$/);
    if (h2Match) {
      const headingText = h2Match[1].trim();
      const lowerHeading = headingText.toLowerCase();
      // Skip raw markdown TOC section since we render an interactive TOC sidebar
      if (
        headingText.includes('目次') ||
        lowerHeading.includes('table of contents') ||
        lowerHeading.includes('sommaire')
      ) {
        currentSection = {
          id: '__toc__',
          title: headingText,
          level: 2,
          rawLines: []
        };
        continue;
      }
      currentSection = {
        id: slugifyHeading(headingText),
        title: headingText,
        level: 2,
        rawLines: []
      };
      sections.push(currentSection);
      continue;
    }

    if (currentSection) {
      if (currentSection.id !== '__toc__') {
        currentSection.rawLines.push(line);
      }
    } else {
      introLines.push(line);
    }
  }

  return { title, introLines, sections };
}

function formatInlineMarkdownToHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&lt;br\s*\/?&gt;/gi, '<br/>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="md-link">$1</a>');
}

function renderLinesToHtml(lines: string[]): string {
  let html = '';
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed || trimmed === '---') {
      i++;
      continue;
    }

    // Code block
    if (trimmed.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(
          lines[i]
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
        );
        i++;
      }
      i++; // skip closing ```
      html += `<pre class="code-block"><code>${codeLines.join('\n')}</code></pre>`;
      continue;
    }

    // Subheading ###
    const h3Match = line.match(/^###\s+(.+)$/);
    if (h3Match) {
      html += `<h3>${formatInlineMarkdownToHtml(h3Match[1].trim())}</h3>`;
      i++;
      continue;
    }

    // Markdown Table
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }
      if (tableLines.length >= 2) {
        const parseRow = (r: string) =>
          r
            .slice(1, -1)
            .split('|')
            .map(c => c.trim());
        const headers = parseRow(tableLines[0]);
        const dataRows = tableLines.slice(2).map(parseRow);
        html += `<div class="table-wrap"><table><thead><tr>${headers
          .map(h => `<th>${formatInlineMarkdownToHtml(h)}</th>`)
          .join('')}</tr></thead><tbody>${dataRows
          .map(
            row =>
              `<tr>${row
                .map(cell => `<td>${formatInlineMarkdownToHtml(cell)}</td>`)
                .join('')}</tr>`
          )
          .join('')}</tbody></table></div>`;
      }
      continue;
    }

    // Unordered or Ordered List
    if (/^(\s*[-*]|\s*\d+\.)\s+/.test(line)) {
      const listItems: { indent: number; ordered: boolean; content: string }[] = [];
      while (i < lines.length && /^(\s*[-*]|\s*\d+\.)\s+/.test(lines[i])) {
        const m = lines[i].match(/^(\s*)([-*]|\d+\.)\s+(.+)$/);
        if (m) {
          listItems.push({
            indent: m[1].length,
            ordered: /\d+\./.test(m[2]),
            content: m[3].trim()
          });
        }
        i++;
      }
      html += `<ul class="md-list">${listItems
        .map(
          item =>
            `<li style="margin-left:${Math.min(item.indent * 8, 32)}px">${formatInlineMarkdownToHtml(
              item.content
            )}</li>`
        )
        .join('')}</ul>`;
      continue;
    }

    // Regular paragraph
    html += `<p>${formatInlineMarkdownToHtml(trimmed)}</p>`;
    i++;
  }

  return html;
}

function buildLangLayoutHtml(lang: GuideLanguage, md: string, isDefaultVisible: boolean): string {
  const { title, introLines, sections } = parseMarkdownSections(md);
  const fileName = getReadmeFilenameByLang(lang);
  const tocLabel =
    lang === 'en' ? 'Table of Contents' : lang === 'fr' ? 'Sommaire' : '目次 / Contents';

  const tocHtml = sections
    .map(
      sec =>
        `<a href="#${lang}-${sec.id}" class="toc-item">${sec.title
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')}</a>`
    )
    .join('');

  const sectionsHtml = sections
    .map(
      sec => `
      <section id="${lang}-${sec.id}" class="doc-section">
        <h2>${formatInlineMarkdownToHtml(sec.title)}</h2>
        ${renderLinesToHtml(sec.rawLines)}
      </section>`
    )
    .join('');

  return `
  <div id="guide-lang-${lang}" class="layout lang-pane" style="display:${isDefaultVisible ? 'flex' : 'none'}">
    <aside class="sidebar">
      <div class="sidebar-title">${tocLabel}</div>
      ${tocHtml}
    </aside>
    <main class="content">
      <div class="hero">
        <span class="hero-badge">${fileName} / USER GUIDE</span>
        <h1>${formatInlineMarkdownToHtml(title)}</h1>
        ${renderLinesToHtml(introLines)}
      </div>
      ${sectionsHtml}
    </main>
  </div>`;
}

function convertMultiLangMarkdownToHtmlDocument(initialLang: GuideLanguage): string {
  const jaPane = buildLangLayoutHtml('ja', readmeJaRaw, initialLang === 'ja');
  const enPane = buildLangLayoutHtml('en', readmeEnRaw, initialLang === 'en');
  const frPane = buildLangLayoutHtml('fr', readmeFrRaw, initialLang === 'fr');

  return `<!DOCTYPE html>
<html lang="${initialLang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NavFOR — User Guide / 使い方ガイド / Guide d'utilisation (README.md)</title>
  <style>
    :root {
      color-scheme: light;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Hiragino Sans", "Noto Sans JP", sans-serif;
      background: #f8fafc;
      color: #1e293b;
      line-height: 1.7;
    }
    .topbar {
      position: sticky;
      top: 0;
      z-index: 50;
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: blur(8px);
      border-bottom: 1px solid #e2e8f0;
      padding: 12px 24px;
    }
    .topbar-inner {
      max-width: 1160px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 800;
      font-size: 14px;
      color: #0f172a;
    }
    .brand-badge {
      background: #4f46e5;
      color: #ffffff;
      padding: 3px 9px;
      border-radius: 7px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.04em;
    }
    .lang-switcher {
      display: inline-flex;
      background: #f1f5f9;
      padding: 3px;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
      gap: 4px;
    }
    .lang-btn {
      border: none;
      background: transparent;
      color: #475569;
      font-size: 12px;
      font-weight: 700;
      padding: 6px 12px;
      border-radius: 7px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .lang-btn:hover {
      color: #0f172a;
    }
    .lang-btn.active {
      background: #4f46e5;
      color: #ffffff;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12);
    }
    .layout {
      max-width: 1160px;
      margin: 0 auto;
      display: flex;
      gap: 28px;
      padding: 28px 20px 64px;
    }
    .sidebar {
      width: 270px;
      flex-shrink: 0;
      position: sticky;
      top: 76px;
      align-self: flex-start;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 16px;
      max-height: calc(100vh - 96px);
      overflow-y: auto;
    }
    .sidebar-title {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #64748b;
      margin: 0 0 10px 4px;
    }
    .toc-item {
      display: block;
      padding: 7px 10px;
      font-size: 12.5px;
      font-weight: 600;
      color: #475569;
      text-decoration: none;
      border-radius: 8px;
      transition: all 0.15s;
    }
    .toc-item:hover {
      background: #eef2ff;
      color: #4f46e5;
    }
    .content {
      flex: 1;
      min-width: 0;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 32px 36px;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.03);
    }
    .hero {
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 20px;
      margin-bottom: 28px;
    }
    .hero-badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 800;
      color: #4f46e5;
      background: #eef2ff;
      padding: 3px 10px;
      border-radius: 6px;
      margin-bottom: 8px;
    }
    h1 {
      font-size: 26px;
      line-height: 1.3;
      margin: 0 0 12px;
      color: #0f172a;
    }
    .doc-section {
      padding-top: 12px;
      margin-bottom: 32px;
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 24px;
      scroll-margin-top: 76px;
    }
    .doc-section:last-child {
      border-bottom: none;
    }
    h2 {
      font-size: 19px;
      color: #0f172a;
      margin: 0 0 14px;
      padding-left: 12px;
      border-left: 4px solid #4f46e5;
    }
    h3 {
      font-size: 15px;
      color: #334155;
      margin: 18px 0 8px;
    }
    p {
      margin: 0 0 12px;
      font-size: 14px;
      color: #334155;
    }
    .md-list {
      margin: 0 0 14px;
      padding-left: 20px;
      font-size: 14px;
      color: #334155;
    }
    .md-list li {
      margin-bottom: 6px;
    }
    .inline-code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12.5px;
      background: #f1f5f9;
      color: #4338ca;
      padding: 2px 6px;
      border-radius: 5px;
      border: 1px solid #e2e8f0;
    }
    .code-block {
      background: #0f172a;
      color: #f8fafc;
      padding: 14px 16px;
      border-radius: 10px;
      overflow-x: auto;
      font-size: 13px;
      margin: 10px 0 16px;
    }
    .table-wrap {
      overflow-x: auto;
      margin: 12px 0 18px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13.5px;
    }
    th, td {
      border: 1px solid #e2e8f0;
      padding: 10px 12px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background: #f8fafc;
      font-weight: 700;
      color: #1e293b;
    }
    tr:nth-child(even) td {
      background: #fcfdff;
    }
    .md-link {
      color: #4f46e5;
      text-decoration: underline;
    }
    @media (max-width: 820px) {
      .layout {
        flex-direction: column;
        padding: 12px;
      }
      .sidebar {
        width: 100%;
        position: static;
        max-height: none;
      }
      .content {
        padding: 20px 16px;
      }
    }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="topbar-inner">
      <div class="brand">
        <span class="brand-badge">NavFOR</span>
        <span>User Guide / 使い方ガイド / Guide d'utilisation</span>
      </div>
      <div class="lang-switcher" role="group" aria-label="Language Switcher">
        <button type="button" id="btn-lang-ja" class="lang-btn ${initialLang === 'ja' ? 'active' : ''}" onclick="switchLang('ja')">🇯🇵 日本語 (README.md)</button>
        <button type="button" id="btn-lang-en" class="lang-btn ${initialLang === 'en' ? 'active' : ''}" onclick="switchLang('en')">🇬🇧 English (README.en.md)</button>
        <button type="button" id="btn-lang-fr" class="lang-btn ${initialLang === 'fr' ? 'active' : ''}" onclick="switchLang('fr')">🇫🇷 Français (README.fr.md)</button>
      </div>
    </div>
  </header>
  ${jaPane}
  ${enPane}
  ${frPane}
  <script>
    function switchLang(lang) {
      ['ja', 'en', 'fr'].forEach(function(l) {
        var pane = document.getElementById('guide-lang-' + l);
        var btn = document.getElementById('btn-lang-' + l);
        if (pane) pane.style.display = (l === lang) ? 'flex' : 'none';
        if (btn) {
          if (l === lang) btn.classList.add('active');
          else btn.classList.remove('active');
        }
      });
      document.documentElement.lang = lang;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  </script>
</body>
</html>`;
}

// Render inline markdown tokens into React nodes safely
function renderInlineNodes(text: string): React.ReactNode[] {
  // Handle <br> tags first
  const brParts = text.split(/<br\s*\/?>/i);
  if (brParts.length > 1) {
    return brParts.map((part, idx) => (
      <React.Fragment key={idx}>
        {idx > 0 && <br />}
        {renderInlineNodes(part)}
      </React.Fragment>
    ));
  }

  // Tokenize **bold** and `code`
  const tokenRegex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  const parts = text.split(tokenRegex);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-bold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={i}
          className="px-1.5 py-0.5 mx-0.5 text-[11.5px] font-mono font-semibold bg-indigo-50/80 text-indigo-700 border border-indigo-100 rounded"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

function renderSectionBody(lines: string[]) {
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed || trimmed === '---') {
      i++;
      continue;
    }

    // Code block
    if (trimmed.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      elements.push(
        <pre
          key={`code-${i}`}
          className="bg-slate-900 text-slate-100 p-3.5 rounded-xl text-xs font-mono overflow-x-auto my-2.5 shadow-inner"
        >
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    // H3 subheading
    const h3Match = line.match(/^###\s+(.+)$/);
    if (h3Match) {
      elements.push(
        <h4
          key={`h3-${i}`}
          className="text-sm font-bold text-slate-800 mt-4 mb-1.5 flex items-center gap-1.5"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
          <span>{renderInlineNodes(h3Match[1].trim())}</span>
        </h4>
      );
      i++;
      continue;
    }

    // Table
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }
      if (tableLines.length >= 2) {
        const parseRow = (r: string) =>
          r
            .slice(1, -1)
            .split('|')
            .map(c => c.trim());
        const headers = parseRow(tableLines[0]);
        const rows = tableLines.slice(2).map(parseRow);

        elements.push(
          <div key={`tbl-${i}`} className="overflow-x-auto my-3 rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                  {headers.map((h, hIdx) => (
                    <th key={hIdx} className="py-2.5 px-3">
                      {renderInlineNodes(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-50/70">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="py-2.5 px-3 text-slate-600 align-top leading-relaxed">
                        {renderInlineNodes(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    // List items
    if (/^(\s*[-*]|\s*\d+\.)\s+/.test(line)) {
      const items: { indent: number; marker: string; text: string }[] = [];
      while (i < lines.length && /^(\s*[-*]|\s*\d+\.)\s+/.test(lines[i])) {
        const m = lines[i].match(/^(\s*)([-*]|\d+\.)\s+(.+)$/);
        if (m) {
          items.push({
            indent: m[1].length,
            marker: m[2],
            text: m[3].trim()
          });
        }
        i++;
      }
      elements.push(
        <ul key={`list-${i}`} className="space-y-1.5 my-2 text-xs sm:text-[13px] text-slate-600">
          {items.map((item, idx) => (
            <li
              key={idx}
              style={{ paddingLeft: `${Math.min(item.indent * 8, 28)}px` }}
              className="flex items-start gap-2 leading-relaxed"
            >
              <span className="text-indigo-500 font-bold select-none shrink-0 mt-0.5">
                {/\d+\./.test(item.marker) ? item.marker : '•'}
              </span>
              <span className="flex-1">{renderInlineNodes(item.text)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Paragraph
    elements.push(
      <p key={`p-${i}`} className="text-xs sm:text-[13px] text-slate-600 leading-relaxed my-2">
        {renderInlineNodes(trimmed)}
      </p>
    );
    i++;
  }

  return elements;
}

export function useStandaloneReadmeHtmlUrl(language?: string): string {
  const [url, setUrl] = useState<string>('');
  const normalizedLang = normalizeGuideLang(language);

  useEffect(() => {
    const html = convertMultiLangMarkdownToHtmlDocument(normalizedLang);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [normalizedLang]);

  return url;
}

export function downloadReadmeMarkdown(language?: string) {
  const content = getReadmeMarkdownByLang(language);
  const fileName = getReadmeFilenameByLang(language);
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  language?: string;
  onChangeLanguage?: (lang: GuideLanguage) => void;
}

export const UserGuideModal: React.FC<UserGuideModalProps> = ({
  isOpen,
  onClose,
  language = 'ja',
  onChangeLanguage
}) => {
  const [guideLang, setGuideLang] = useState<GuideLanguage>(() => normalizeGuideLang(language));

  useEffect(() => {
    setGuideLang(normalizeGuideLang(language));
  }, [language]);

  const L = (ja: string, en: string, fr: string) => tr(guideLang, ja, en, fr);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSectionId, setActiveSectionId] = useState<string>('');
  const [showMobileToc, setShowMobileToc] = useState(false);
  const contentContainerRef = useRef<HTMLDivElement>(null);
  const standaloneHtmlUrl = useStandaloneReadmeHtmlUrl(guideLang);

  const activeMarkdownRaw = useMemo(() => getReadmeMarkdownByLang(guideLang), [guideLang]);
  const activeFileName = useMemo(() => getReadmeFilenameByLang(guideLang), [guideLang]);
  const parsed = useMemo(() => parseMarkdownSections(activeMarkdownRaw), [activeMarkdownRaw]);

  const filteredSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return parsed.sections;
    return parsed.sections.filter(
      sec =>
        sec.title.toLowerCase().includes(q) ||
        sec.rawLines.some(line => line.toLowerCase().includes(q))
    );
  }, [parsed.sections, searchQuery]);

  useEffect(() => {
    if (parsed.sections.length > 0) {
      setActiveSectionId(parsed.sections[0].id);
    }
    if (contentContainerRef.current) {
      contentContainerRef.current.scrollTop = 0;
    }
  }, [parsed.sections]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelectGuideLang = (nextLang: GuideLanguage) => {
    setGuideLang(nextLang);
    if (onChangeLanguage) {
      onChangeLanguage(nextLang);
    }
  };

  const scrollToSection = (id: string) => {
    setActiveSectionId(id);
    setShowMobileToc(false);
    const el = document.getElementById(`guide-sec-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-5xl h-[92vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Modal Header */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 bg-slate-50/90 flex items-center justify-between gap-3 shrink-0 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <BookOpen size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                  {L('NavFOR 使い方ガイド', 'NavFOR User Guide', "Guide d'utilisation NavFOR")}
                </h2>
                <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                  {activeFileName}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                {L(
                  'Explorer・Timeline・Task Detail・Focus・ローカル3世代バックアップの操作マニュアル',
                  'Complete manual for Explorer, Timeline, Task Detail, Focus, and 3-file Local Backup',
                  'Manuel complet : Explorateur, Chronologie, Détails, Focus et Sauvegarde locale'
                )}
              </p>
            </div>
          </div>

          {/* Right Actions: Language Switcher (JA/EN/FR), Open as HTML Web Page, Download .md, Close */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Language Switcher Pill */}
            <div
              className="flex items-center bg-slate-200/70 p-0.5 rounded-xl border border-slate-200"
              title={L('ガイドの表示言語を切り替え', 'Switch Guide Language', 'Changer la langue du guide')}
            >
              <Globe size={13} className="text-slate-500 ml-1.5 mr-1 hidden sm:inline shrink-0" />
              {(['ja', 'en', 'fr'] as GuideLanguage[]).map(langCode => {
                const isCurrent = guideLang === langCode;
                const label = langCode === 'ja' ? '日本語' : langCode === 'en' ? 'EN' : 'FR';
                return (
                  <button
                    key={langCode}
                    type="button"
                    onClick={() => handleSelectGuideLang(langCode)}
                    className={cn(
                      'px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer',
                      isCurrent
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Mobile TOC Toggle */}
            <button
              type="button"
              onClick={() => setShowMobileToc(prev => !prev)}
              className="md:hidden px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold flex items-center gap-1 shadow-2xs"
            >
              <List size={14} className="text-indigo-600" />
              <span>{L('目次', 'TOC', 'Sommaire')}</span>
            </button>

            {standaloneHtmlUrl && (
              <a
                href={standaloneHtmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                title={L(
                  '日・英・仏切替対応の独立したWebページ(HTML)として新しいタブで開きます',
                  'Open as a standalone HTML web page (with JA/EN/FR switcher) in a new tab',
                  'Ouvrir comme page web HTML autonome (JA/EN/FR) dans un nouvel onglet'
                )}
              >
                <ExternalLink size={13} className="shrink-0" />
                <span>{L('Webページとして別タブで開く', 'Open as Web Page', 'Ouvrir en page Web')}</span>
              </a>
            )}

            <button
              type="button"
              onClick={() => downloadReadmeMarkdown(guideLang)}
              className="hidden sm:flex px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
              title={L(
                `${activeFileName} をダウンロード`,
                `Download ${activeFileName}`,
                `Télécharger ${activeFileName}`
              )}
            >
              <Download size={13} className="text-slate-500 shrink-0" />
              <span>{activeFileName}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-800 border border-slate-200 transition-colors cursor-pointer"
              title={L('閉じる (Esc)', 'Close (Esc)', 'Fermer (Échap)')}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-4 sm:px-6 py-2.5 border-b border-slate-100 bg-white flex items-center gap-2 shrink-0">
          <Search size={14} className="text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={L(
              '使い方ガイド内を検索 (例: Timeline, Focus, 全画面, バックアップ, ショートカット...)',
              'Search in User Guide (e.g. Timeline, Focus, Fullscreen, Backup, Shortcuts...)',
              'Rechercher dans le guide (ex. Timeline, Focus, Plein écran, Sauvegarde, Raccourcis...)'
            )}
            className="w-full text-xs text-slate-800 placeholder:text-slate-400 outline-none bg-transparent"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-[11px] text-slate-400 hover:text-slate-700 font-bold px-1.5 py-0.5 rounded bg-slate-100"
            >
              {L('クリア', 'Clear', 'Effacer')}
            </button>
          )}
        </div>

        {/* Main Body: Left TOC Sidebar + Right Markdown Content */}
        <div className="flex-1 min-h-0 flex overflow-hidden relative">
          {/* Left TOC Sidebar */}
          <aside
            className={cn(
              'w-64 shrink-0 border-r border-slate-200 bg-slate-50/70 p-3 overflow-y-auto custom-scrollbar',
              showMobileToc
                ? 'absolute inset-y-0 left-0 z-30 bg-white shadow-xl block'
                : 'hidden md:block'
            )}
          >
            <div className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
              {L('目次 (セクション一覧)', 'Table of Contents', 'Sommaire')}
            </div>
            <nav className="mt-1 space-y-1">
              {parsed.sections.map(sec => {
                const isActive = activeSectionId === sec.id;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => scrollToSection(sec.id)}
                    className={cn(
                      'w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-between gap-1.5 transition-all cursor-pointer',
                      isActive
                        ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                        : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                    )}
                  >
                    <span className="truncate">{sec.title}</span>
                    <ChevronRight
                      size={12}
                      className={cn('shrink-0', isActive ? 'text-white' : 'text-slate-400')}
                    />
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Right Content Scroll Area */}
          <div
            ref={contentContainerRef}
            className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 md:p-8 space-y-8 bg-white"
          >
            {/* Intro Banner */}
            {!searchQuery && (
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-indigo-50/90 via-white to-slate-50 border border-indigo-100/80">
                <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold mb-1.5">
                  <FileText size={14} />
                  <span>{parsed.title}</span>
                  <span className="text-[10px] font-mono text-indigo-500 bg-white px-1.5 py-0.5 rounded border border-indigo-100">
                    {activeFileName}
                  </span>
                </div>
                <div>{renderSectionBody(parsed.introLines)}</div>
              </div>
            )}

            {/* Filtered Sections */}
            {filteredSections.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs">
                {L(
                  `「${searchQuery}」に一致する項目が見つかりませんでした。`,
                  `No sections matching "${searchQuery}".`,
                  `Aucun résultat pour « ${searchQuery} ».`
                )}
              </div>
            ) : (
              filteredSections.map(sec => (
                <section
                  key={sec.id}
                  id={`guide-sec-${sec.id}`}
                  className="scroll-mt-4 pb-6 border-b border-slate-100 last:border-b-0"
                >
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-3 pl-3 border-l-4 border-indigo-600">
                    {sec.title}
                  </h3>
                  <div className="space-y-2">{renderSectionBody(sec.rawLines)}</div>
                </section>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
