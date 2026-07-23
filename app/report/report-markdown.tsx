import type { ReactNode } from "react";

function renderInlineMarkdown(text: string): ReactNode[] {
  const pattern = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;

  return text.split(pattern).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }

    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);

    if (link) {
      const url = link[2].trim();

      if (/^https?:\/\//i.test(url)) {
        return (
          <a href={url} key={index} rel="noreferrer" target="_blank">
            {link[1]}
          </a>
        );
      }

      return link[1];
    }

    return part;
  });
}

function splitTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableSeparator(line: string) {
  const cells = splitTableRow(line);
  return (
    cells.length > 1 &&
    cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, "")))
  );
}

export default function ReportMarkdown({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (
      line.includes("|") &&
      lines[index + 1]?.includes("|") &&
      isTableSeparator(lines[index + 1])
    ) {
      const tableLines: string[] = [];

      while (index < lines.length && lines[index].includes("|")) {
        tableLines.push(lines[index]);
        index += 1;
      }

      const header = splitTableRow(tableLines[0]);
      const rows = tableLines.slice(2).map(splitTableRow);

      blocks.push(
        <div className="report-table-wrap" key={`table-${index}`}>
          <table>
            <thead>
              <tr>
                {header.map((cell, cellIndex) => (
                  <th key={cellIndex}>{renderInlineMarkdown(cell)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>{renderInlineMarkdown(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];

      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\d+\.\s+/, ""));
        index += 1;
      }

      blocks.push(
        <ol key={`ol-${index}`}>
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInlineMarkdown(item)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];

      while (index < lines.length && /^[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^[-*]\s+/, ""));
        index += 1;
      }

      blocks.push(
        <ul key={`ul-${index}`}>
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInlineMarkdown(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (line.startsWith("### ")) {
      blocks.push(
        <h3 key={`h3-${index}`}>{renderInlineMarkdown(line.slice(4))}</h3>,
      );
      index += 1;
      continue;
    }

    if (line.startsWith("## ")) {
      blocks.push(
        <h2 key={`h2-${index}`}>{renderInlineMarkdown(line.slice(3))}</h2>,
      );
      index += 1;
      continue;
    }

    if (line.startsWith("# ")) {
      blocks.push(
        <h1 key={`h1-${index}`}>{renderInlineMarkdown(line.slice(2))}</h1>,
      );
      index += 1;
      continue;
    }

    if (line.startsWith("> ")) {
      blocks.push(
        <blockquote key={`quote-${index}`}>
          {renderInlineMarkdown(line.slice(2))}
        </blockquote>,
      );
      index += 1;
      continue;
    }

    blocks.push(<p key={`p-${index}`}>{renderInlineMarkdown(line)}</p>);
    index += 1;
  }

  return <div className="report-markdown">{blocks}</div>;
}
