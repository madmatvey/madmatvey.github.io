export function toc() {
  if (document.querySelector('main h2, main h3')) {
    const contentSelector = 'main article .content';

    // Function to add aria-label to TOC links
    const addAriaLabelsToTocLinks = () => {
      const tocLinks = document.querySelectorAll('#toc .toc-link');
      tocLinks.forEach(link => {
        if (!link.getAttribute('aria-label')) {
          const linkText = link.textContent.trim();
          const href = link.getAttribute('href');
          if (href && linkText) {
            link.setAttribute('aria-label', `Go to section: ${linkText}`);
          }
        }
      });
    };

    const getHeadingElements = () =>
      document.querySelectorAll(`${contentSelector} h2, ${contentSelector} h3, ${contentSelector} h4`);

    const buildFallbackToc = () => {
      const tocElement = document.getElementById('toc');
      if (!tocElement) return;

      const headings = Array.from(getHeadingElements()).filter((heading) => heading.id);
      if (headings.length <= 1) return;

      const list = document.createElement('ul');
      list.className = 'toc-list';

      headings.forEach((heading) => {
        const item = document.createElement('li');
        const link = document.createElement('a');

        link.className = 'toc-link';
        link.href = `#${heading.id}`;
        link.textContent = heading.textContent.trim();
        link.setAttribute('aria-label', `Go to section: ${heading.textContent.trim()}`);

        item.appendChild(link);
        list.appendChild(item);
      });

      tocElement.innerHTML = '';
      tocElement.appendChild(list);
      document.getElementById('toc-wrapper').classList.remove('d-none');
    };

    const ensureTocIsComplete = () => {
      const headingCount = getHeadingElements().length;
      const tocCount = document.querySelectorAll('#toc .toc-link').length;

      if (headingCount > 1 && tocCount <= 1) {
        buildFallbackToc();
      }
    };

    if (typeof tocbot === 'undefined') {
      buildFallbackToc();
      addAriaLabelsToTocLinks();
      return;
    }

    try {
      // see: https://github.com/tscanlin/tocbot#usage
      tocbot.init({
        tocSelector: '#toc',
        // Limit TOC source strictly to the post body, not sidebar/panel blocks.
        contentSelector,
        ignoreSelector: '[data-toc-skip]',
        headingSelector: 'h2, h3, h4',
        orderedList: false,
        scrollSmooth: false,
        onClickCallback: function() {
          addAriaLabelsToTocLinks();
        }
      });
    } catch (error) {
      buildFallbackToc();
      addAriaLabelsToTocLinks();
      return;
    }

    document.getElementById('toc-wrapper').classList.remove('d-none');
    
    // Add aria-label to TOC links after initial generation
    setTimeout(addAriaLabelsToTocLinks, 100);
    setTimeout(addAriaLabelsToTocLinks, 500);
    setTimeout(ensureTocIsComplete, 200);
    setTimeout(ensureTocIsComplete, 800);
    
    // Use MutationObserver to watch for dynamically added TOC links
    const tocElement = document.getElementById('toc');
    if (tocElement) {
      const observer = new MutationObserver(() => {
        addAriaLabelsToTocLinks();
        ensureTocIsComplete();
      });
      
      observer.observe(tocElement, {
        childList: true,
        subtree: true
      });
    }
  }
}
