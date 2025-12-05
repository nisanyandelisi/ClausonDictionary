import React, { useMemo } from 'react';
import { normalizeClausonWord } from '../utils/textUtils';

const RichTextParser = ({ text, wordList }) => {
    // Helper to parse HTML string into a tree structure
    const parseHtmlToTree = (htmlString) => {
        if (!htmlString) return [];

        // Split by <b>, </b>, <i>, </i> tags (case insensitive)
        const tokens = htmlString.split(/(<\/?(?:b|i)>)/gi);
        const root = { type: 'root', children: [] };
        const stack = [root];

        tokens.forEach(token => {
            if (!token) return;

            const lowerToken = token.toLowerCase();

            if (lowerToken === '<b>') {
                const node = { type: 'b', children: [] };
                stack[stack.length - 1].children.push(node);
                stack.push(node);
            } else if (lowerToken === '</b>') {
                // Only pop if we are currently in a bold tag
                if (stack.length > 1 && stack[stack.length - 1].type === 'b') {
                    stack.pop();
                }
            } else if (lowerToken === '<i>') {
                const node = { type: 'i', children: [] };
                stack[stack.length - 1].children.push(node);
                stack.push(node);
            } else if (lowerToken === '</i>') {
                // Only pop if we are currently in an italic tag
                if (stack.length > 1 && stack[stack.length - 1].type === 'i') {
                    stack.pop();
                }
            } else {
                // Text content
                stack[stack.length - 1].children.push({ type: 'text', content: token });
            }
        });

        return root.children;
    };

    // Helper to apply smart linking to text content
    const linkifyText = (textContent) => {
        // Split by whitespace and punctuation, capturing delimiters to preserve them
        // Removed ':' from the main split to prioritize words containing it (like tı:d-)
        const parts = textContent.split(/(\s+|[.,;!?()"'])/);

        return parts.map((part, index) => {
            // Skip empty parts or delimiters
            if (!part || part.match(/^(\s+|[.,;!?()"'])$/)) {
                return part;
            }

            // Case-sensitive exact match check
            if (wordList && wordList.size > 0 && wordList.has(part)) {
                return (
                    <span
                        key={index}
                        onClick={() => window.location.hash = `#/kelime/${encodeURIComponent(part)}`}
                        className="text-[#89b1d4] font-semibold hover:underline transition-colors cursor-pointer"
                    >
                        {part}
                    </span>
                );
            }

            return part;
        });
    };

    // Recursive renderer
    const renderTree = (nodes, keyPrefix = 'root', isInsideBold = false, isInsideItalic = false) => {
        return nodes.map((node, index) => {
            const key = `${keyPrefix}-${index}`;

            if (node.type === 'text') {
                // Only linkify if we are inside a <b> tag AND NOT inside an <i> tag
                if (isInsideBold && !isInsideItalic) {
                    return <React.Fragment key={key}>{linkifyText(node.content)}</React.Fragment>;
                }
                return <span key={key}>{node.content}</span>;
            }

            // Pass down the isInsideBold and isInsideItalic state
            const children = renderTree(
                node.children,
                key,
                isInsideBold || node.type === 'b',
                isInsideItalic || node.type === 'i'
            );

            if (node.type === 'b') {
                return <b key={key}>{children}</b>;
            }

            if (node.type === 'i') {
                return <i key={key}>{children}</i>;
            }

            return <span key={key}>{children}</span>;
        });
    };

    const content = useMemo(() => {
        try {
            if (text) {
                console.log(`[RichTextParser] Parsing text, wordList size: ${wordList?.size || 0}`);
            }
            const tree = parseHtmlToTree(text);
            return renderTree(tree);
        } catch (e) {
            console.error('[RichTextParser] Error parsing text:', e);
            return text;
        }
    }, [text, wordList]);

    return <div className="leading-relaxed text-[#f4f4f4]">{content}</div>;
};

export default RichTextParser;
