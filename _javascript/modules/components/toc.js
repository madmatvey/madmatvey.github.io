export function toc() {
  if (document.querySelector('main h2, main h3')) {
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

    // see: https://github.com/tscanlin/tocbot#usage
    tocbot.init({
      tocSelector: '#toc',
      contentSelector: '.content',
      ignoreSelector: '[data-toc-skip]',
      headingSelector: 'h2, h3, h4',
      orderedList: false,
      scrollSmooth: false,
      onClickCallback: function() {
        addAriaLabelsToTocLinks();
      }
    });

    document.getElementById('toc-wrapper').classList.remove('d-none');
    
    // Add aria-label to TOC links after initial generation
    setTimeout(addAriaLabelsToTocLinks, 100);
    setTimeout(addAriaLabelsToTocLinks, 500);
    
    // Use MutationObserver to watch for dynamically added TOC links
    const tocElement = document.getElementById('toc');
    if (tocElement) {
      const observer = new MutationObserver(() => {
        addAriaLabelsToTocLinks();
      });
      
      observer.observe(tocElement, {
        childList: true,
        subtree: true
      });
    }
  }
}
