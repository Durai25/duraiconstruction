const services = {
  'residential-construction': {
    number: '01',
    category: 'Residential construction',
    title: 'Residential Construction',
    summary: 'Thoughtful construction for individual houses, villas and apartments.',
    description: 'Build a home around the way you want to live, with a clear scope for the work and a team focused on the details that matter.',
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0a?auto=format&fit=crop&w=2200&q=88',
    imageAlt: 'Modern detached home with landscaped grounds',
    overviewTitle: 'A home built around your plans.',
    scope: ['Individual houses, villas and apartments', 'Foundations and structural construction', 'Interior works and finishing'],
    details: [
      ['Start with the brief', 'Share your plans, site details and priorities so the project scope can be understood.'],
      ['Coordinate the work', 'Keep construction and on-site coordination aligned with the agreed project requirements.'],
      ['Finish with care', 'Bring the planned construction and finishing work together for handover.'],
    ],
  },
  'commercial-construction': {
    number: '02',
    category: 'Commercial construction',
    title: 'Commercial Construction',
    summary: 'Construction for offices, shops and commercial buildings.',
    description: 'Create practical spaces for businesses, customers and teams with construction shaped around the requirements of your building.',
    image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=2200&q=88',
    imageAlt: 'Contemporary commercial office buildings',
    overviewTitle: 'Commercial spaces made for business.',
    scope: ['Offices and workplaces', 'Shops and customer-facing spaces', 'Commercial buildings'],
    details: [
      ['Define the requirements', 'Align the intended use of the space with a clear project scope.'],
      ['Plan the construction', 'Coordinate the work around the building requirements and agreed milestones.'],
      ['Complete the space', 'Bring the construction scope together for a considered handover.'],
    ],
  },
  'industrial-construction': {
    number: '03',
    category: 'Industrial construction',
    title: 'Industrial Construction',
    summary: 'Construction for factories, warehouses and industrial structures.',
    description: 'Plan industrial construction around the needs of your facility, from the agreed scope to coordinated work on site.',
    image: 'https://images.unsplash.com/photo-1565514020179-026b92b84bb6?auto=format&fit=crop&w=2200&q=88',
    imageAlt: 'Industrial warehouse and logistics facility',
    overviewTitle: 'Practical spaces for industrial use.',
    scope: ['Factories and production facilities', 'Warehouses and storage buildings', 'Industrial structures'],
    details: [
      ['Understand the site', 'Discuss your facility, site conditions and project priorities.'],
      ['Agree the scope', 'Set out the construction work and responsibilities before work begins.'],
      ['Coordinate delivery', 'Keep the agreed scope and on-site work moving together.'],
    ],
  },
  'turnkey-projects': {
    number: '04',
    category: 'Turnkey projects',
    title: 'Turnkey Projects',
    summary: 'Complete construction coordinated from planning through handover.',
    description: 'Bring the stages of a build together in one coordinated project scope, from early planning through construction and handover.',
    image: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=2200&q=88',
    imageAlt: 'Construction site underway with heavy equipment',
    overviewTitle: 'One coordinated path from plan to handover.',
    scope: ['Project planning and scope alignment', 'Coordinated construction work', 'Finishing and handover'],
    details: [
      ['Plan the project', 'Align the scope, schedule and responsibilities at the outset.'],
      ['Coordinate construction', 'Keep the agreed project stages and site work connected.'],
      ['Prepare for handover', 'Bring the planned work to completion and review the details.'],
    ],
  },
  renovation: {
    number: '05',
    category: 'Renovation',
    title: 'Renovation',
    summary: 'Building renovation and remodeling for existing spaces.',
    description: 'Refresh or rework an existing building with construction and finishing work matched to its needs and intended use.',
    image: 'https://images.unsplash.com/photo-1511818966892-d7d671e672a2?auto=format&fit=crop&w=2200&q=88',
    imageAlt: 'Renovated contemporary building exterior',
    overviewTitle: 'A considered update to your space.',
    scope: ['Building renovation and remodeling', 'Interior updates and finishing', 'Construction work for existing buildings'],
    details: [
      ['Review what is there', 'Discuss the existing space and the changes you want to make.'],
      ['Set a practical scope', 'Agree which renovation and remodeling work is part of the project.'],
      ['Bring the update together', 'Coordinate the work and finishing with the intended result.'],
    ],
  },
  'structural-works': {
    number: '06',
    category: 'Structural works',
    title: 'Structural Works',
    summary: 'RCC, foundations, columns and beams for construction projects.',
    description: 'Build the structural elements that form the foundation of a project, with work shaped around the agreed drawings and scope.',
    image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=2200&q=88',
    imageAlt: 'Construction team carrying out structural work on site',
    overviewTitle: 'Strong structural work starts with a clear scope.',
    scope: ['RCC construction', 'Foundations', 'Columns and beams'],
    details: [
      ['Confirm the requirements', 'Review the structural work and project scope before getting started.'],
      ['Coordinate on site', 'Align the work with the site and construction requirements.'],
      ['Keep the details in view', 'Carry out the agreed structural work with attention to the project details.'],
    ],
  },
  'interior-works': {
    number: '07',
    category: 'Interior works',
    title: 'Interior Works',
    summary: 'Interior design and finishing for thoughtfully completed spaces.',
    description: 'Bring interior design and finishing together to make a space feel considered, functional and ready to use.',
    image: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=2200&q=88',
    imageAlt: 'Finished modern interior with carefully detailed furnishings',
    overviewTitle: 'Finishing details that bring a room together.',
    scope: ['Interior design', 'Interior finishing', 'Residential and commercial interiors'],
    details: [
      ['Understand the space', 'Discuss how the space will be used and what you want it to feel like.'],
      ['Align the design and finish', 'Set the interior scope and finishing requirements for the project.'],
      ['Complete the interior', 'Bring the agreed finishing work together across the space.'],
    ],
  },
  'civil-contracting': {
    number: '08',
    category: 'Civil contracting',
    title: 'Civil Contracting',
    summary: 'Labour and material-based contracts for civil construction work.',
    description: 'Choose a civil contracting scope that suits your project, with labour and materials arranged around the agreed requirements.',
    image: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=2200&q=88',
    imageAlt: 'Urban infrastructure and civil construction',
    overviewTitle: 'A clear contracting scope for civil work.',
    scope: ['Labour-based contracts', 'Material-based contracts', 'Civil construction work'],
    details: [
      ['Set out the work', 'Discuss the project requirements and the civil work to be covered.'],
      ['Choose the contract scope', 'Align labour and materials with the agreed project arrangement.'],
      ['Coordinate the work', 'Keep the work on site connected to the agreed scope.'],
    ],
  },
};

const menuToggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('#main-nav');
const servicePage = document.querySelector('#service-page');
const serviceNotFound = document.querySelector('#service-not-found');
const service = services[new URLSearchParams(window.location.search).get('service')];

document.querySelector('#year').textContent = new Date().getFullYear();

menuToggle.addEventListener('click', () => {
  const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
  menuToggle.setAttribute('aria-expanded', String(!expanded));
  menuToggle.setAttribute('aria-label', expanded ? 'Open navigation' : 'Close navigation');
  nav.classList.toggle('open', !expanded);
});

nav.addEventListener('click', (event) => {
  if (!event.target.closest('a')) return;
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', 'Open navigation');
  nav.classList.remove('open');
});

if (!service) {
  serviceNotFound.hidden = false;
} else {
  document.title = `${service.title} | Durai Construction`;
  document.querySelector('meta[name="description"]').content = service.description;
  document.querySelector('#service-category').textContent = service.category;
  document.querySelector('#service-title').textContent = service.title;
  document.querySelector('#service-summary').textContent = service.summary;
  document.querySelector('#service-number').textContent = `${service.number} / 08`;
  document.querySelector('#service-image').src = service.image;
  document.querySelector('#service-image').alt = service.imageAlt;
  document.querySelector('#service-overview-title').textContent = service.overviewTitle;
  document.querySelector('#service-overview-text').textContent = service.description;

  const scopeList = document.querySelector('#service-scope-list');
  service.scope.forEach((item) => {
    const listItem = document.createElement('li');
    listItem.textContent = item;
    scopeList.append(listItem);
  });

  const detailList = document.querySelector('#service-detail-list');
  service.details.forEach(([title, description], index) => {
    const article = document.createElement('article');
    article.className = 'service-detail-point service-reveal';
    const number = document.createElement('span');
    number.className = 'service-detail-number';
    number.textContent = `0${index + 1}`;
    const heading = document.createElement('h3');
    heading.textContent = title;
    const copy = document.createElement('p');
    copy.textContent = description;
    article.append(number, heading, copy);
    detailList.append(article);
  });

  const relatedList = document.querySelector('#related-service-list');
  Object.entries(services).filter(([slug]) => slug !== new URLSearchParams(window.location.search).get('service')).forEach(([slug, item]) => {
    const link = document.createElement('a');
    link.className = 'related-service service-reveal';
    link.href = `service.html?service=${slug}`;
    const number = document.createElement('span');
    number.textContent = item.number;
    const title = document.createElement('strong');
    title.textContent = item.title;
    const arrow = document.createElement('span');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '↗';
    link.append(number, title, arrow);
    relatedList.append(link);
  });

  servicePage.hidden = false;

  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
    document.body.classList.add('has-scroll-reveals');
    const sections = servicePage.querySelectorAll('.service-scroll-section');
    sections.forEach((section) => {
      section.dataset.scrollSection = '';
      section.querySelectorAll('.service-reveal').forEach((item, index) => {
        item.classList.add('scroll-reveal-item');
        item.style.setProperty('--reveal-order', String(index % 6));
      });
    });

    const sectionObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -8% 0px' });

    sections.forEach((section) => sectionObserver.observe(section));
  }
}
