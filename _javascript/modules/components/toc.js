export function toc() {
  const contentSelector = 'main article .content';
  const tocElement = document.getElementById('toc');
  const tocWrapper = document.getElementById('toc-wrapper');

  if (!tocElement || !tocWrapper) return;

  if (tocElement.querySelector('.toc-list')) return;

  const headings = Array.from(
    document.querySelectorAll(`${contentSelector} h2, ${contentSelector} h3, ${contentSelector} h4`)
  ).filter((heading) => heading.id);

  if (headings.length <= 1) return;

  const list = document.createElement('ul');
  list.className = 'toc-list';

  headings.forEach((heading) => {
    const item = document.createElement('li');
    item.className = 'toc-list-item';

    const link = document.createElement('a');
    link.className = `toc-link node-name--${heading.tagName}`;
    link.href = `#${heading.id}`;
    
    let textContent = heading.textContent;
    while (textContent.includes('Link to section:')) {
      textContent = textContent.replace('Link to section:', '');
    }
    textContent = textContent.replace(/#+$/, '').trim();
    
    const uniqueWords = textContent.split(' ').filter((word, index, arr) => arr.indexOf(word) === index);
    textContent = uniqueWords.join(' ');
    
    link.textContent = textContent;
    link.setAttribute('aria-label', `Go to section: ${textContent}`);

    item.appendChild(link);
    list.appendChild(item);
  });

  tocElement.innerHTML = '';
  tocElement.appendChild(list);
  tocWrapper.classList.remove('d-none');

  const setActiveLink = () => {
    let current = headings[0];
    const threshold = 140;

    for (const heading of headings) {
      if (heading.getBoundingClientRect().top <= threshold) {
        current = heading;
      } else {
        break;
      }
    }

    const links = tocElement.querySelectorAll('.toc-link');
    links.forEach((link) => {
      const isActive = link.getAttribute('href') === `#${current.id}`;
      link.classList.toggle('is-active-link', isActive);
      link.parentElement?.classList.toggle('is-active-li', isActive);
    });
  };

  setActiveLink();
  document.addEventListener('scroll', setActiveLink, { passive: true });
  window.addEventListener('hashchange', setActiveLink);
}
