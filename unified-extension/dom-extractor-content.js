/**
 * DOM Extractor - Extract DOM exactly as an agent would see it
 */

if (typeof window.DOMExtractorDefinition === 'undefined') {
    window.DOMExtractorDefinition = true;

    class DOMExtractor {
        constructor(options = {}) {
            this.options = {
                includeHidden: options.includeHidden || false,
                maxDepth: options.maxDepth || 50,
                includeStyles: options.includeStyles || false,
                includeBoundingBox: options.includeBoundingBox || true,
                interactiveOnly: options.interactiveOnly || false,
                ...options
            };
        }

        extractAll() {
            return {
                timestamp: new Date().toISOString(),
                url: window.location.href,
                title: document.title,
                viewport: this.getViewport(),
                formats: {
                    simplifiedHTML: this.extractSimplifiedHTML(),
                    structuredText: this.extractStructuredText(),
                    interactiveElements: this.extractInteractiveElements(),
                    accessibilityTree: this.extractAccessibilityTree(),
                    flatElementList: this.extractFlatElementList(),
                    semanticRegions: this.extractSemanticRegions()
                }
            };
        }

        getViewport() {
            return {
                width: window.innerWidth,
                height: window.innerHeight,
                scrollX: window.scrollX,
                scrollY: window.scrollY,
                documentHeight: document.documentElement.scrollHeight,
                documentWidth: document.documentElement.scrollWidth
            };
        }

        extractSimplifiedHTML() {
            const clone = document.body.cloneNode(true);
            const removeSelectors = ['script', 'style', 'noscript', 'svg', 'path', 'meta', 'link'];
            removeSelectors.forEach(sel => {
                clone.querySelectorAll(sel).forEach(el => el.remove());
            });

            if (!this.options.includeHidden) {
                clone.querySelectorAll('*').forEach(el => {
                    const style = window.getComputedStyle(document.body.contains(el) ? el : document.body);
                    if (style.display === 'none' || style.visibility === 'hidden') {
                        el.remove();
                    }
                });
            }

            const essentialAttrs = ['id', 'class', 'href', 'src', 'alt', 'title', 'type', 'name', 'value', 'placeholder', 'aria-label', 'role', 'data-testid'];
            clone.querySelectorAll('*').forEach(el => {
                Array.from(el.attributes).forEach(attr => {
                    if (!essentialAttrs.includes(attr.name) && !attr.name.startsWith('aria-')) {
                        el.removeAttribute(attr.name);
                    }
                });
            });

            return this.formatHTML(clone.innerHTML);
        }

        extractStructuredText() {
            const lines = [];

            const processNode = (node, depth = 0) => {
                const indent = '  '.repeat(depth);

                if (node.nodeType === Node.TEXT_NODE) {
                    const text = node.textContent.trim();
                    if (text) {
                        lines.push(`${indent}TEXT: "${text}"`);
                    }
                    return;
                }

                if (node.nodeType !== Node.ELEMENT_NODE) return;

                const el = node;
                const tag = el.tagName.toLowerCase();

                if (['script', 'style', 'noscript', 'meta', 'link'].includes(tag)) return;

                const rect = el.getBoundingClientRect();
                if (rect.width === 0 && rect.height === 0) return;

                let desc = `${indent}[${tag.toUpperCase()}]`;

                if (el.id) desc += ` #${el.id}`;
                if (el.className && typeof el.className === 'string') {
                    desc += ` .${el.className.split(' ').filter(c => c).join('.')}`;
                }

                if (el.getAttribute('role')) desc += ` role="${el.getAttribute('role')}"`;
                if (el.getAttribute('aria-label')) desc += ` aria-label="${el.getAttribute('aria-label')}"`;

                if (tag === 'a' && el.href) desc += ` href="${el.href}"`;
                if (tag === 'img' && el.alt) desc += ` alt="${el.alt}"`;
                if (tag === 'input') desc += ` type="${el.type}" name="${el.name || ''}"`;
                if (tag === 'button' || tag === 'a' || tag === 'input') {
                    desc += ` [INTERACTIVE]`;
                }

                lines.push(desc);

                if (depth < this.options.maxDepth) {
                    Array.from(el.childNodes).forEach(child => processNode(child, depth + 1));
                }
            };

            processNode(document.body);
            return lines.join('\n');
        }

        extractInteractiveElements() {
            const interactiveSelectors = [
                'a[href]', 'button', 'input', 'select', 'textarea',
                '[role="button"]', '[role="link"]', '[role="menuitem"]',
                '[role="tab"]', '[role="checkbox"]', '[role="radio"]',
                '[onclick]', '[tabindex]:not([tabindex="-1"])'
            ];

            const elements = document.querySelectorAll(interactiveSelectors.join(','));
            const results = [];
            let index = 0;

            elements.forEach(el => {
                const rect = el.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0) return;
                if (!this.isVisible(el)) return;

                const item = {
                    index: index++,
                    tag: el.tagName.toLowerCase(),
                    type: this.getElementType(el),
                    text: this.getElementText(el),
                    attributes: this.getRelevantAttributes(el),
                    boundingBox: {
                        x: Math.round(rect.x),
                        y: Math.round(rect.y),
                        width: Math.round(rect.width),
                        height: Math.round(rect.height),
                        centerX: Math.round(rect.x + rect.width / 2),
                        centerY: Math.round(rect.y + rect.height / 2)
                    },
                    isInViewport: this.isInViewport(rect),
                    xpath: this.getXPath(el),
                    cssSelector: this.getCSSSelector(el)
                };

                results.push(item);
            });

            return results;
        }

        extractAccessibilityTree() {
            const tree = [];

            const processElement = (el, depth = 0) => {
                if (!el || el.nodeType !== Node.ELEMENT_NODE) return;

                const tag = el.tagName.toLowerCase();
                if (['script', 'style', 'noscript'].includes(tag)) return;

                const role = el.getAttribute('role') || this.getImplicitRole(el);
                const name = this.getAccessibleName(el);
                const rect = el.getBoundingClientRect();

                if (rect.width === 0 && rect.height === 0 && !['head', 'meta'].includes(tag)) return;

                const node = {
                    depth,
                    role: role || tag,
                    name: name || undefined,
                    tag,
                    states: this.getAccessibilityStates(el),
                    bounds: rect.width > 0 ? {
                        x: Math.round(rect.x),
                        y: Math.round(rect.y),
                        width: Math.round(rect.width),
                        height: Math.round(rect.height)
                    } : undefined
                };

                if (role || name || this.isInteractive(el)) {
                    tree.push(node);
                }

                if (depth < this.options.maxDepth) {
                    Array.from(el.children).forEach(child => processElement(child, depth + 1));
                }
            };

            processElement(document.body);
            return tree;
        }

        extractFlatElementList() {
            const elements = document.body.querySelectorAll('*');
            const list = [];
            let id = 0;

            elements.forEach(el => {
                const tag = el.tagName.toLowerCase();
                if (['script', 'style', 'noscript', 'br', 'hr'].includes(tag)) return;

                const rect = el.getBoundingClientRect();
                if (rect.width === 0 && rect.height === 0) return;

                const text = this.getDirectText(el);

                list.push({
                    id: id++,
                    tag,
                    text: text || undefined,
                    role: el.getAttribute('role') || this.getImplicitRole(el),
                    interactive: this.isInteractive(el),
                    bounds: {
                        x: Math.round(rect.x),
                        y: Math.round(rect.y),
                        w: Math.round(rect.width),
                        h: Math.round(rect.height)
                    },
                    visible: this.isInViewport(rect)
                });
            });

            return list;
        }

        extractSemanticRegions() {
            const regions = [];
            const landmarks = {
                'header, [role="banner"]': 'header',
                'nav, [role="navigation"]': 'navigation',
                'main, [role="main"]': 'main',
                'aside, [role="complementary"]': 'sidebar',
                'footer, [role="contentinfo"]': 'footer',
                'form, [role="form"]': 'form',
                'search, [role="search"]': 'search',
                'section[aria-label], section[aria-labelledby]': 'section',
                'article, [role="article"]': 'article'
            };

            Object.entries(landmarks).forEach(([selector, type]) => {
                document.querySelectorAll(selector).forEach(el => {
                    const rect = el.getBoundingClientRect();
                    if (rect.width === 0 || rect.height === 0) return;

                    regions.push({
                        type,
                        label: el.getAttribute('aria-label') || el.getAttribute('title') || undefined,
                        bounds: {
                            x: Math.round(rect.x),
                            y: Math.round(rect.y),
                            width: Math.round(rect.width),
                            height: Math.round(rect.height)
                        },
                        interactiveCount: el.querySelectorAll('a, button, input, select, textarea').length,
                        textPreview: this.getTextPreview(el, 100)
                    });
                });
            });

            return regions;
        }

        // Helper Methods
        isVisible(el) {
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
        }

        isInViewport(rect) {
            return rect.top < window.innerHeight && rect.bottom > 0 && rect.left < window.innerWidth && rect.right > 0;
        }

        isInteractive(el) {
            const tag = el.tagName.toLowerCase();
            const role = el.getAttribute('role');
            const interactiveTags = ['a', 'button', 'input', 'select', 'textarea'];
            const interactiveRoles = ['button', 'link', 'menuitem', 'tab', 'checkbox', 'radio', 'textbox'];

            return interactiveTags.includes(tag) || interactiveRoles.includes(role) ||
                el.hasAttribute('onclick') || (el.hasAttribute('tabindex') && el.getAttribute('tabindex') !== '-1');
        }

        getElementType(el) {
            const tag = el.tagName.toLowerCase();
            if (tag === 'a') return 'link';
            if (tag === 'button') return 'button';
            if (tag === 'input') return `input-${el.type}`;
            if (tag === 'select') return 'dropdown';
            if (tag === 'textarea') return 'textarea';
            return el.getAttribute('role') || tag;
        }

        getElementText(el) {
            if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
            const text = el.innerText?.trim();
            if (text && text.length < 200) return text;
            if (text) return text.substring(0, 200) + '...';
            if (el.value) return el.value;
            if (el.title) return el.title;
            if (el.alt) return el.alt;
            return '';
        }

        getDirectText(el) {
            let text = '';
            el.childNodes.forEach(node => {
                if (node.nodeType === Node.TEXT_NODE) {
                    text += node.textContent;
                }
            });
            return text.trim().substring(0, 100);
        }

        getTextPreview(el, maxLength = 100) {
            const text = el.innerText?.trim() || '';
            if (text.length <= maxLength) return text;
            return text.substring(0, maxLength) + '...';
        }

        getRelevantAttributes(el) {
            const attrs = {};
            const relevant = ['id', 'class', 'href', 'src', 'alt', 'title', 'type', 'name', 'value', 'placeholder', 'aria-label', 'role', 'data-testid'];
            relevant.forEach(name => {
                const val = el.getAttribute(name);
                if (val) attrs[name] = val;
            });
            return attrs;
        }

        getXPath(el) {
            const parts = [];
            while (el && el.nodeType === Node.ELEMENT_NODE) {
                let index = 1;
                let sibling = el.previousElementSibling;
                while (sibling) {
                    if (sibling.tagName === el.tagName) index++;
                    sibling = sibling.previousElementSibling;
                }
                parts.unshift(`${el.tagName.toLowerCase()}[${index}]`);
                el = el.parentElement;
            }
            return '/' + parts.join('/');
        }

        getCSSSelector(el) {
            if (el.id) return `#${el.id}`;
            const parts = [];
            while (el && el.nodeType === Node.ELEMENT_NODE && el !== document.body) {
                let selector = el.tagName.toLowerCase();
                if (el.id) {
                    selector = `#${el.id}`;
                    parts.unshift(selector);
                    break;
                }
                if (el.className && typeof el.className === 'string') {
                    selector += '.' + el.className.trim().split(/\s+/).join('.');
                }
                parts.unshift(selector);
                el = el.parentElement;
            }
            return parts.join(' > ');
        }

        getImplicitRole(el) {
            const roleMap = {
                'a[href]': 'link', 'button': 'button', 'input[type="button"]': 'button',
                'input[type="submit"]': 'button', 'input[type="checkbox"]': 'checkbox',
                'input[type="radio"]': 'radio', 'input[type="text"]': 'textbox',
                'input[type="search"]': 'searchbox', 'textarea': 'textbox',
                'select': 'combobox', 'img': 'img', 'nav': 'navigation',
                'main': 'main', 'header': 'banner', 'footer': 'contentinfo',
                'aside': 'complementary', 'form': 'form', 'ul': 'list',
                'ol': 'list', 'li': 'listitem', 'table': 'table', 'tr': 'row',
                'th': 'columnheader', 'td': 'cell', 'article': 'article',
                'section': 'region', 'h1': 'heading', 'h2': 'heading',
                'h3': 'heading', 'h4': 'heading', 'h5': 'heading', 'h6': 'heading'
            };

            const tag = el.tagName.toLowerCase();
            if (tag === 'input') return roleMap[`input[type="${el.type}"]`] || 'textbox';
            if (tag === 'a' && el.hasAttribute('href')) return 'link';
            return roleMap[tag] || null;
        }

        getAccessibleName(el) {
            const labelledBy = el.getAttribute('aria-labelledby');
            if (labelledBy) {
                const labels = labelledBy.split(' ').map(id => document.getElementById(id)?.textContent).filter(Boolean);
                if (labels.length) return labels.join(' ');
            }
            if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
            if (el.id) {
                const label = document.querySelector(`label[for="${el.id}"]`);
                if (label) return label.textContent?.trim();
            }
            if (el.title) return el.title;
            if (el.alt) return el.alt;
            const text = el.textContent?.trim();
            if (text && text.length < 100) return text;
            return null;
        }

        getAccessibilityStates(el) {
            const states = [];
            if (el.disabled) states.push('disabled');
            if (el.checked) states.push('checked');
            if (el.selected) states.push('selected');
            if (el.getAttribute('aria-expanded') === 'true') states.push('expanded');
            if (el.getAttribute('aria-expanded') === 'false') states.push('collapsed');
            if (el.getAttribute('aria-hidden') === 'true') states.push('hidden');
            if (el.getAttribute('aria-pressed') === 'true') states.push('pressed');
            if (el.getAttribute('aria-selected') === 'true') states.push('selected');
            if (document.activeElement === el) states.push('focused');
            return states.length ? states : undefined;
        }

        formatHTML(html) {
            return html.replace(/>\s+</g, '>\n<').replace(/(<[^>]+>)/g, '\n$1').split('\n').filter(line => line.trim()).join('\n');
        }
    }

    // Listen for extraction requests from the side panel
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'extractDOM') {
            const extractor = new DOMExtractor(request.options || {});
            const result = extractor.extractAll();
            sendResponse(result);
        }
        return true;
    });
}

