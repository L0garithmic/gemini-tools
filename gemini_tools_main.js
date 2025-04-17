// ==UserScript==
// @name         Sticky Code Copy Button (Gemini UI) - v10.2 Context Filename/Ext Priority
// @namespace    http://tampermonkey.net/
// @version      10.2
// @description  Sticky/collapsible code headers with copy/download (context filename/ext priority). Dynamically adds button when code block finishes generating.
// @match        https://gemini.google.com/*
// @grant        GM_addStyle
// @author       L0garithmic
// @updateURL    https://yourwebsite.com/myuserscript.meta.js
// @downloadURL  https://yourwebsite.com/myuserscript.user.js
// ==/UserScript==

(function() {
    'use strict';

    const styleId = 'sticky-code-header-styles-v10-context-priority';
    const MAX_LINES_EXPANDED = 50;
    const MAX_LINES_COLLAPSED = 10;
    const SCROLLBAR_WIDTH = '10px';
    const FADE_WIDTH = '30px';
    const CODE_BLOCK_BORDER_RADIUS = '4px';
    const DOWNLOAD_BUTTON_CLASS = 'download-code-button';

    function getElementStyleValue(element, property) {
        if (!element) return 0;
        try {
            return parseFloat(window.getComputedStyle(element)[property]) || 0;
        } catch (err) {
            return 0;
        }
    }

    function getLineHeight(element) {
        if (!element) return 18;
        try {
            const computedStyle = window.getComputedStyle(element);
            let lineHeight = computedStyle.lineHeight;
            if (lineHeight === 'normal' || !lineHeight) {
                const fontSize = parseFloat(computedStyle.fontSize) || 16;
                lineHeight = Math.round(fontSize * 1.2);
            } else {
                lineHeight = parseFloat(lineHeight);
            }
            return lineHeight || 18;
        } catch (err) {
            return 18;
        }
    }

    function applyVisibilityHeight(codeBlock, maxLines) {
        const container = codeBlock.querySelector('.formatted-code-block-internal-container');
        const preElement = container && container.querySelector('pre');
        if (!container || !preElement) return;

        container.style.height = '';
        container.style.minHeight = '';

        if (maxLines <= 0) {
            container.style.maxHeight = '0px';
            return;
        }

        const lineHeight = getLineHeight(preElement);
        const paddingTop = getElementStyleValue(container, 'paddingTop');
        const paddingBottom = getElementStyleValue(container, 'paddingBottom');
        const borderTop = getElementStyleValue(container, 'borderTopWidth');
        const borderBottom = getElementStyleValue(container, 'borderBottomWidth');

        const internalHeight = (maxLines * lineHeight) + paddingTop + paddingBottom + borderTop + borderBottom;

        container.style.maxHeight = internalHeight + 'px';
    }

    function updateFadeOverlay(codeBlock, shouldBeCollapsed, isInitialSetup = false) {
        const container = codeBlock.querySelector('.formatted-code-block-internal-container');
        if (!container) return;

        let fadeOverlay = codeBlock.querySelector(':scope > .fade-overlay');

        if (shouldBeCollapsed) {
            const isVerticallyOverflown = container.scrollHeight > container.clientHeight + 1;
            const currentMaxHeight = parseFloat(container.style.maxHeight);
            const isActuallyCollapsed = !isNaN(currentMaxHeight) && currentMaxHeight < container.scrollHeight;

            if (!fadeOverlay && (isActuallyCollapsed || isVerticallyOverflown || isInitialSetup)) {
                fadeOverlay = document.createElement('div');
                fadeOverlay.className = 'fade-overlay';
                fadeOverlay.addEventListener('click', (event) => {
                    event.stopPropagation();
                    const header = codeBlock.querySelector('.code-block-decoration');
                    if (header) header.click();
                });
                codeBlock.appendChild(fadeOverlay);
            } else if (fadeOverlay && !isActuallyCollapsed && !isVerticallyOverflown && !isInitialSetup) {
                 fadeOverlay.remove();
            }
        } else {
            if (fadeOverlay) {
                fadeOverlay.remove();
            }
        }
    }

    function getFileExtensionForLanguage(language) {
        const langLower = language.toLowerCase().trim();
        switch (langLower) {
            case 'python': return 'py';
            case 'php': return 'php';
            case 'json': return 'json';
            case 'bash':
            case 'shell':
            case 'sh': return 'sh';
            case 'javascript': return 'js';
            case 'html': return 'html';
            case 'css': return 'css';
            case 'xml': return 'xml';
            case 'sql': return 'sql';
            case 'typescript': return 'ts';
            case 'java': return 'java';
            case 'c++': return 'cpp';
            case 'c#': return 'cs';
            case 'go': return 'go';
            case 'ruby': return 'rb';
            case 'swift': return 'swift';
            case 'kotlin': return 'kt';
            case 'rust': return 'rs';
            case 'vue': return 'vue';
            default: return 'txt';
        }
    }

    function extractFilenameFromCode(codeContent, language) {
        if (!codeContent) return null;
        const lines = codeContent.split('\n').slice(0, 10);
        const patterns = [
            /(?:#|\/\/)\s*Filename:\s*([\w.-]+)/i,
            /<title>(.*?)<\/title>/i,
            /<script.*?src=['"](?:.*\/)?([\w.-]+?)['"]/i,
            /<link.*?href=['"](?:.*\/)?([\w.-]+\.css)['"]/i,
            /(?:include|require)(?:_once)?\s*['"]([\w.-]+\.php)['"]/i,
            /class\s+([\w_]+)/i,
            /(?:function|def)\s+([\w_]+)\s*\(/i,
            /(?:const|let|var|filename|file)\s*=\s*['"]([\w.-]+?\.(?:js|py|php|html|css|json|xml|sh|txt|sql|ts|java|cpp|cs|go|rb|swift|kt|rs|vue))['"]/i
        ];

        for (const line of lines) {
            for (const pattern of patterns) {
                const match = line.match(pattern);
                if (match && match[1]) {
                    let potentialName = match[1].trim();
                    potentialName = potentialName.substring(potentialName.lastIndexOf('/') + 1);
                    potentialName = potentialName.substring(potentialName.lastIndexOf('\\') + 1);

                    const isNamePattern = pattern.source.includes('class\\s+') || pattern.source.includes('(?:function|def)\\s+') || pattern.source.includes('<title>');
                    if (!isNamePattern) {
                         potentialName = potentialName.replace(/\.(?:js|py|php|html|css|json|xml|sh|txt|sql|ts|java|cpp|cs|go|rb|swift|kt|rs|vue)$/i, '');
                    }

                    potentialName = potentialName.replace(/[^a-z0-9_-]/gi, '_').replace(/_+/g, '_');
                    potentialName = potentialName.replace(/^_+|_+$/g, '');

                    if (potentialName && potentialName.length > 0 && potentialName !== '_') {
                        console.log("Extracted filename base from code:", potentialName);
                        return potentialName;
                    }
                }
            }
        }

        console.log("No specific filename found in first 10 lines of code.");
        return null;
    }

    function findPrecedingFilename(codeBlockWrapperElement) {
        const responseElement = codeBlockWrapperElement.closest('response-element');
        if (!responseElement) {
             console.log("Could not find suitable parent element for context.");
            return null;
        }

        let sibling = responseElement.previousElementSibling;
        for (let i = 0; i < 3 && sibling; i++) {
            if (['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'LI'].includes(sibling.tagName)) {
                const strongTag = sibling.querySelector('strong code');
                const codeTag = sibling.querySelector('code');
                const textSource = strongTag || codeTag || sibling;
                const text = textSource.textContent.trim();
                const fileMatch = text.match(/(?:(?:[Ff]ile(?:name)?)\s*[: ]?\s*)?([\w\/.-]+\.[\w]+)/);

                if (fileMatch && fileMatch[1]) {
                     const matchedFilenameWithPath = fileMatch[1];
                     if (!matchedFilenameWithPath.startsWith('http') && matchedFilenameWithPath.includes('.')) {
                        const filenameOnly = matchedFilenameWithPath.substring(matchedFilenameWithPath.lastIndexOf('/') + 1);
                         const baseNameMatch = filenameOnly.match(/^(.+)\.([^/.]+)$/);

                         if (baseNameMatch && baseNameMatch[1] && baseNameMatch[2]) {
                             const baseName = baseNameMatch[1];
                             const extension = baseNameMatch[2];
                             console.log("Found preceding filename hint:", baseName, " Extension:", extension);
                             return { baseName, extension };
                         }
                     }
                }
            }
            sibling = sibling.previousElementSibling;
        }
        console.log("No preceding filename found in siblings.");
        return null;
    }


    function handleDownloadClick(event) {
        event.stopPropagation();
        const button = event.currentTarget;
        const codeBlock = button.closest('.code-block');
        const header = codeBlock?.querySelector('.code-block-decoration');
        const langSpan = header?.querySelector('span:not(.buttons)');
        const preElement = codeBlock?.querySelector('pre');
        const codeElement = preElement?.querySelector('code');

        if (!codeBlock || !header || !langSpan || !preElement || !codeElement) {
            console.error("Could not find necessary elements for download.");
            return;
        }

        const languageFromHeader = langSpan.textContent || 'code';
        const codeContent = codeElement.innerText || codeElement.textContent || '';

        let baseFilename = null;
        let fileExtension = null;

        const precedingFileInfo = findPrecedingFilename(codeBlock);
        if (precedingFileInfo) {
            baseFilename = precedingFileInfo.baseName;
            fileExtension = precedingFileInfo.extension;
            console.log("Using filename/ext from preceding text:", baseFilename, fileExtension);
        }

        if (!baseFilename) {
            baseFilename = extractFilenameFromCode(codeContent, languageFromHeader);
            if (baseFilename) {
                console.log("Using filename from code content:", baseFilename);
            }
        }

        if (!fileExtension) {
            fileExtension = getFileExtensionForLanguage(languageFromHeader);
             console.log("Using extension from language header:", fileExtension);
        }

        if (!baseFilename) {
            baseFilename = `gemini-${languageFromHeader.toLowerCase().replace(/[^a-z0-9]/gi, '_') || 'code'}`;
            console.log("Using default base filename:", baseFilename);
        }

        baseFilename = baseFilename.replace(/[^a-z0-9_-]/gi, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
        if (!baseFilename || baseFilename === '_') {
             baseFilename = `gemini-${languageFromHeader.toLowerCase().replace(/[^a-z0-9]/gi, '_') || 'code'}`;
        }

        const filename = `${baseFilename}.${fileExtension}`;
        console.log("Final Download Filename:", filename);

        const blob = new Blob([codeContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function addDownloadButton(codeBlock) {
        const header = codeBlock.querySelector('.code-block-decoration');
        const buttonsContainer = header?.querySelector('.buttons');
        if (!buttonsContainer || header.querySelector(`.${DOWNLOAD_BUTTON_CLASS}`)) {
            return;
        }

        const copyButton = buttonsContainer.querySelector('.copy-button');

        const downloadButton = document.createElement('button');
        downloadButton.className = `mdc-icon-button mat-mdc-icon-button mat-mdc-button-base mat-unthemed ${DOWNLOAD_BUTTON_CLASS}`;
        downloadButton.setAttribute('aria-label', 'Download code');
        downloadButton.setAttribute('mat-icon-button', '');
        downloadButton.setAttribute('mattooltip', 'Download code');
        downloadButton.setAttribute('jslog', '179063;track:generic_click');

        const rippleSpan = document.createElement('span');
        rippleSpan.className = 'mat-mdc-button-persistent-ripple mdc-icon-button__ripple';
        downloadButton.appendChild(rippleSpan);

        const icon = document.createElement('mat-icon');
        icon.className = 'mat-icon notranslate google-symbols mat-ligature-font mat-icon-no-color';
        icon.setAttribute('role', 'img');
        icon.setAttribute('aria-hidden', 'true');
        icon.setAttribute('data-mat-icon-type', 'font');
        icon.setAttribute('fonticon', 'download');
        icon.textContent = 'download';
        downloadButton.appendChild(icon);

        const focusIndicator = document.createElement('span');
        focusIndicator.className = 'mat-focus-indicator';
        downloadButton.appendChild(focusIndicator);

        const touchTarget = document.createElement('span');
        touchTarget.className = 'mat-mdc-button-touch-target';
        downloadButton.appendChild(touchTarget);

        const rippleLoader = document.createElement('span');
        rippleLoader.className = 'mat-ripple mat-mdc-button-ripple';
        downloadButton.appendChild(rippleLoader);

        downloadButton.addEventListener('click', handleDownloadClick);

        if (copyButton && copyButton.nextSibling) {
            buttonsContainer.insertBefore(downloadButton, copyButton.nextSibling);
        } else if (copyButton) {
             buttonsContainer.appendChild(downloadButton);
        } else {
            buttonsContainer.insertBefore(downloadButton, buttonsContainer.firstChild);
        }
    }

    function processCodeBlock(codeBlock, isInitialSetup) {
        const header = codeBlock.querySelector('.code-block-decoration');

        if (header && !header.dataset.clickable) {
            header.style.cursor = 'pointer';
            header.dataset.clickable = 'true';
        }

        addDownloadButton(codeBlock);

        const shouldBeCollapsed = isInitialSetup || codeBlock.classList.contains('code-block-collapsed');

        if (shouldBeCollapsed) {
            if (isInitialSetup && !codeBlock.classList.contains('code-block-collapsed')) {
                codeBlock.classList.add('code-block-collapsed');
            }
            applyVisibilityHeight(codeBlock, MAX_LINES_COLLAPSED);
             setTimeout(() => updateFadeOverlay(codeBlock, true, isInitialSetup), 0);
        } else {
             applyVisibilityHeight(codeBlock, MAX_LINES_EXPANDED);
             updateFadeOverlay(codeBlock, false, false);
        }
    }

    function handleClickDelegation(event) {
        const header = event.target.closest('.code-block-decoration');
        if (!header) return;

        if (event.target.closest('.copy-button') || event.target.closest(`.${DOWNLOAD_BUTTON_CLASS}`) || event.target.closest('a')) {
            return;
        }

        const codeBlock = header.closest('.code-block');
        if (!codeBlock) return;

        const isCollapsed = codeBlock.classList.contains('code-block-collapsed');

        if (isCollapsed) {
            codeBlock.classList.remove('code-block-collapsed');
            applyVisibilityHeight(codeBlock, MAX_LINES_EXPANDED);
            updateFadeOverlay(codeBlock, false, false);
        } else {
            codeBlock.classList.add('code-block-collapsed');
            applyVisibilityHeight(codeBlock, MAX_LINES_COLLAPSED);
            setTimeout(() => updateFadeOverlay(codeBlock, true, false), 0);
        }
    }

    function addGlobalStyles() {
        if (document.getElementById(styleId)) return;
        GM_addStyle(`
            div.code-block {
                overflow: hidden !important;
                position: relative !important;
                contain: content !important;
                margin-bottom: 8px;
                border-radius: ${CODE_BLOCK_BORDER_RADIUS} !important;
            }
            div.code-block > div.code-block-decoration {
                position: sticky !important;
                top: 0 !important;
                z-index: 10 !important;
                background-color: var(--surface-container-lowest, #1f1f1f) !important;
                padding: 4px 0 !important;
                cursor: pointer;
                border-bottom: 1px solid var(--border-color-google-grey-700, #5f6368) !important;
                display: flex;
                align-items: center;
                color: var(--text-color-primary-dark, #e8eaed) !important;
                border-top-left-radius: 0 !important;
                border-top-right-radius: 0 !important;
            }
            div.code-block > div.code-block-decoration::before {
                content: '▼'; display: inline-block; font-size: 0.8em;
                margin: 0 8px 0 5px;
                transition: transform 0.2s ease-in-out; vertical-align: middle; flex-shrink: 0; color: inherit !important;
            }
            div.code-block.code-block-collapsed > div.code-block-decoration::before { transform: rotate(-90deg); }
            div.code-block > div.code-block-decoration > span:not(.buttons) {
                flex-grow: 1; margin-left: 0;
                overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: inherit !important;
            }
            div.code-block > div.code-block-decoration > .buttons {
                flex-shrink: 0; margin-left: auto; display: flex !important; align-items: center !important;
                padding-right: 10px !important;
            }
            div.code-block > div.code-block-decoration > .buttons > button {
                color: var(--text-color-primary-dark, #e8eaed) !important; margin-left: 4px;
            }
            div.code-block > div.code-block-decoration > .buttons > .${DOWNLOAD_BUTTON_CLASS} > .mat-icon {
                font-size: 20px;
                height: 20px;
                width: 20px;
                line-height: 20px;
            }

            div.code-block .formatted-code-block-internal-container {
                overflow: auto !important;
                scrollbar-gutter: stable !important;
                transition: max-height 0.2s ease-in-out;
                padding: 0 0 5px 5px !important;
                box-sizing: border-box;
                border: none;
                background-color: var(--surface-container-lowest, #1f1f1f) !important;
                position: relative !important;
                border-bottom-left-radius: 0 !important;
                border-bottom-right-radius: 0 !important;
            }

            div.code-block .formatted-code-block-internal-container::-webkit-scrollbar { width: ${SCROLLBAR_WIDTH}; height: ${SCROLLBAR_WIDTH}; }
            div.code-block .formatted-code-block-internal-container::-webkit-scrollbar-track { background: transparent !important; }
            div.code-block .formatted-code-block-internal-container::-webkit-scrollbar-thumb { background-color: rgba(180, 180, 180, 0.5); border-radius: 5px; border: 2px solid transparent; background-clip: content-box; }
            div.code-block .formatted-code-block-internal-container::-webkit-scrollbar-thumb:hover { background-color: rgba(180, 180, 180, 0.7); }
            div.code-block .formatted-code-block-internal-container::-webkit-scrollbar-corner { background: transparent !important; }

            div.code-block pre {
                overflow-x: auto !important;
                scrollbar-width: thin;
                scrollbar-color: rgba(180, 180, 180, 0.5) transparent;
                white-space: pre !important;
                padding-top: 5px;
                padding-right: 10px !important;
                margin: 0;
                font-family: 'Roboto Mono', monospace;
                font-size: 0.875rem;
                line-height: 1.2rem;
                position: relative;
                z-index: 0;
                box-sizing: border-box;
                min-height: 1.2rem;
            }

             div.code-block pre::-webkit-scrollbar { height: ${SCROLLBAR_WIDTH}; width: ${SCROLLBAR_WIDTH}; }
             div.code-block pre::-webkit-scrollbar-track { background: transparent !important; }
             div.code-block pre::-webkit-scrollbar-thumb { background-color: rgba(180, 180, 180, 0.5); border-radius: 5px; border: 2px solid transparent; background-clip: content-box; }
             div.code-block pre::-webkit-scrollbar-thumb:hover { background-color: rgba(180, 180, 180, 0.7); }
             div.code-block pre::-webkit-scrollbar-corner { background: transparent !important; }

            .fade-overlay {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                height: 2.5rem;
                z-index: 1;
                border-bottom-left-radius: ${CODE_BLOCK_BORDER_RADIUS} !important;
                border-bottom-right-radius: ${CODE_BLOCK_BORDER_RADIUS} !important;
                background: linear-gradient(to bottom, rgba(31, 31, 31, 0), var(--surface-container-lowest, #1f1f1f) 85%) !important;
                -webkit-mask-image: linear-gradient(to right,
                    black 0%,
                    black calc(100% - ${SCROLLBAR_WIDTH} - ${FADE_WIDTH}),
                    transparent calc(100% - ${SCROLLBAR_WIDTH})
                );
                mask-image: linear-gradient(to right,
                    black 0%,
                    black calc(100% - ${SCROLLBAR_WIDTH} - ${FADE_WIDTH}),
                    transparent calc(100% - ${SCROLLBAR_WIDTH})
                );
                cursor: pointer;
                pointer-events: auto;
            }
        `);
    }

    function init() {
        addGlobalStyles();
        document.body.addEventListener('click', handleClickDelegation, true);

        document.querySelectorAll('.code-block').forEach(block => {
            processCodeBlock(block, true);
        });

        const observer = new MutationObserver(mutations => {
            const blocksToRecheck = new Map();

            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType !== Node.ELEMENT_NODE) return;
                    if (node.matches?.('.code-block')) {
                        if (!blocksToRecheck.has(node)) blocksToRecheck.set(node, true);
                    } else {
                        node.querySelectorAll?.('.code-block').forEach(cb => {
                             if (!blocksToRecheck.has(cb)) blocksToRecheck.set(cb, true);
                        });
                    }
                });

                if (mutation.target?.nodeType === Node.ELEMENT_NODE) {
                    const parentBlock = mutation.target.closest('.code-block');
                    if (parentBlock && !blocksToRecheck.has(parentBlock)) {
                         blocksToRecheck.set(parentBlock, false);
                    }
                }
            });

            blocksToRecheck.forEach((isNew, codeBlock) => {
                processCodeBlock(codeBlock, isNew);
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
