import { Hono } from 'hono';
import { marked } from 'marked';
import { promises as fs } from 'fs';
import path from 'path';

const faq = new Hono();

// Function to convert a title to a URL-friendly slug
const toSlug = (title: string) => {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-'); // Replace multiple hyphens with a single one
};

faq.get('/:slug', async (c) => {
    const { slug } = c.req.param();
    const faqPath = path.join(process.cwd(), 'src', 'faq', 'faq.md');

    try {
        const markdownContent = await fs.readFile(faqPath, 'utf-8');
        const sections = markdownContent.split(/^##\s/m);
        const titleMatch = markdownContent.match(/^#\s(.*)/);
        let pageTitle = 'FAQ';
        if (titleMatch && titleMatch[1]) {
            pageTitle = titleMatch[1];
        }

        let foundSection = '';
        let sectionTitle = '';

        for (const section of sections) {
            if (!section.trim()) continue;

            const lines = section.split('\n');
            if (!lines[0]) continue;
            const currentTitle = lines[0].trim();
            const currentSlug = toSlug(currentTitle);

            if (currentSlug === slug) {
                sectionTitle = currentTitle;
                foundSection = lines.slice(1).join('\n');
                break;
            }
        }

        if (foundSection) {
            let htmlContent: string | null = null;
            try {
                const markedResult = marked(foundSection);
                if (typeof markedResult === 'string') {
                    htmlContent = markedResult;
                } else {
                    htmlContent = await markedResult;
                }
            } catch (err) {
                console.error('Markdown parsing error:', err);
            }

            if (htmlContent) {
                const fullHtml = `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>${sectionTitle} - ${pageTitle}</title>
                    <link rel="stylesheet" href="/styles/style.css">
                    <link rel="stylesheet" href="/styles/cs16.css">
                    <style>
                        body {
                            background-color: #1a1a1a;
                            color: #f0f0f0;
                            font-family: 'Arial', sans-serif;
                            line-height: 1.6;
                            padding: 2rem;
                        }
                        .container {
                            max-width: 800px;
                            margin: 0 auto;
                            background-color: #2c2c2c;
                            padding: 2rem;
                            border-radius: 8px;
                            border: 1px solid var(--border-color);
                        }
                        h1 {
                            color: var(--primary-color);
                            border-bottom: 2px solid var(--primary-color);
                            padding-bottom: 0.5rem;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>${sectionTitle}</h1>
                        <div>${htmlContent}</div>
                    </div>
                </body>
                </html>
                `;
                return c.html(fullHtml);
            } else {
                return c.text('Error converting Markdown to HTML.', 500);
            }
        } else {
            return c.text('FAQ section not found.', 404);
        }
    } catch (error) {
        console.error('Error reading or parsing FAQ file:', error);
        return c.text('Could not load FAQ.', 500);
    }
});

export default faq;
