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

  const getHeadingText = (heading) => {
    const clone = heading.cloneNode(true);
    const anchors = clone.querySelectorAll('a, span:not(.me-2)');
    anchors.forEach(el => el.remove());
    return clone.textContent.trim();
  };

  const list = document.createElement('ul');
  list.className = 'toc-list';

  let currentH2Item = null;

  headings.forEach((heading) => {
    const isH3 = heading.tagName === 'H3';
    const item = document.createElement('li');
    item.className = isH3 ? 'toc-list-item toc-list-item--h3' : 'toc-list-item';

    const link = document.createElement('a');
    link.className = `toc-link node-name--${heading.tagName}`;
    link.href = `#${heading.id}`;
    link.textContent = getHeadingText(heading);
    link.setAttribute('aria-label', `Go to section: ${link.textContent}`);

    item.appendChild(link);

    if (!isH3) {
      currentH2Item = item;
      list.appendChild(item);
    } else if (currentH2Item) {
      let sublist = currentH2Item.querySelector('ul');
      if (!sublist) {
        sublist = document.createElement('ul');
        currentH2Item.appendChild(sublist);
      }
      sublist.appendChild(item);
    }
  });

  tocElement.innerHTML = '';
  tocElement.appendChild(list);
  tocWrapper.classList.remove('d-none');

  const updateVisibility = () => {
    const threshold = 140;
    
    let current = headings[0];
    let activeH2Id = null;

    for (const heading of headings) {
      if (heading.getBoundingClientRect().top <= threshold) {
        current = heading;
        if (heading.tagName === 'H2') {
          activeH2Id = heading.id;
        }
      } else {
        break;
      }
    }

    if (!activeH2Id && current.tagName === 'H3') {
      for (let i = headings.indexOf(current) - 1; i >= 0; i--) {
        if (headings[i].tagName === 'H2') {
          activeH2Id = headings[i].id;
          break;
        }
      }
    }

    const allItems = tocElement.querySelectorAll('.toc-list-item');
    const allLinks = tocElement.querySelectorAll('.toc-link');
    
    allLinks.forEach((link) => {
      const linkHref = link.getAttribute('href');
      const isActive = linkHref === `#${current.id}`;
      link.classList.toggle('is-active-link', isActive);
      link.parentElement?.classList.toggle('is-active-li', isActive);
    });

    allItems.forEach((item) => {
      const link = item.querySelector('.toc-link');
      if (!link) return;
      
      const linkHref = link.getAttribute('href').replace('#', '');
      let isVisible = true;
      
      if (item.classList.contains('toc-list-item--h3')) {
        const parentLi = item.closest('.toc-list-item:not(.toc-list-item--h3)');
        const parentLink = parentLi?.querySelector('.toc-link');
        const parentHref = parentLink?.getAttribute('href')?.replace('#', '');
        isVisible = parentHref === activeH2Id;
      }
      
      item.classList.toggle('toc-hidden', !isVisible);
    });
  };

  tocElement.querySelectorAll('.toc-link').forEach((link) => {
    link.addEventListener('click', () => {
      const href = link.getAttribute('href');
      const targetId = href.replace('#', '');
      const targetHeading = headings.find(h => h.id === targetId);
      
      if (targetHeading && targetHeading.tagName === 'H2') {
        link.classList.add('is-active-link');
        link.parentElement?.classList.add('is-active-li');
        
        setTimeout(updateVisibility, 100);
      }
    });
  });

  updateVisibility();
  document.addEventListener('scroll', updateVisibility, { passive: true });
  window.addEventListener('hashchange', updateVisibility);
}
