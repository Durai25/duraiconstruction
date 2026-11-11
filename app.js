import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { addDoc, collection, getFirestore, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
import { emailjsConfig } from './emailjs-config.js';
import { businessContact } from './contact-config.js';

const menuToggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('#main-nav');
const firebaseReady = Object.values(firebaseConfig).every((value) => value && !value.startsWith('YOUR_'));
const emailjsReady = ['publicKey', 'serviceId'].every((key) => {
  const value = emailjsConfig[key];
  return value && !value.startsWith('YOUR_');
});
const database = firebaseReady ? getFirestore(initializeApp(firebaseConfig)) : null;
let emailjsModule;

document.querySelector('#year').textContent = new Date().getFullYear();

function disableContactLink(link) {
  link.removeAttribute('href');
  link.setAttribute('aria-disabled', 'true');
}

const phoneLink = document.querySelector('[data-business-phone]');
if (businessContact.phoneNumber) {
  phoneLink.textContent = businessContact.phoneDisplay || businessContact.phoneNumber;
  phoneLink.href = `tel:${businessContact.phoneNumber}`;
  phoneLink.removeAttribute('aria-disabled');
} else {
  disableContactLink(phoneLink);
}

const whatsappLink = document.querySelector('[data-business-whatsapp]');
if (businessContact.whatsappNumber) {
  const whatsappNumber = businessContact.whatsappNumber.replace(/\D/g, '');
  whatsappLink.textContent = 'Chat with us on WhatsApp';
  whatsappLink.href = `https://wa.me/${whatsappNumber}`;
  whatsappLink.target = '_blank';
  whatsappLink.rel = 'noopener noreferrer';
  whatsappLink.removeAttribute('aria-disabled');
} else {
  disableContactLink(whatsappLink);
}

const emailLink = document.querySelector('[data-business-email]');
if (businessContact.businessEmail) {
  emailLink.textContent = businessContact.businessEmail;
  emailLink.href = `mailto:${businessContact.businessEmail}`;
  emailLink.removeAttribute('aria-disabled');
} else {
  disableContactLink(emailLink);
}

const address = document.querySelector('[data-business-address]');
if (businessContact.officeAddress) address.textContent = businessContact.officeAddress;

const mapLink = document.querySelector('[data-business-map]');
if (businessContact.googleMapsUrl) {
  mapLink.href = businessContact.googleMapsUrl;
  mapLink.target = '_blank';
  mapLink.rel = 'noopener noreferrer';
  mapLink.removeAttribute('aria-disabled');
} else if (businessContact.officeAddress) {
  mapLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(businessContact.officeAddress)}`;
  mapLink.target = '_blank';
  mapLink.rel = 'noopener noreferrer';
  mapLink.removeAttribute('aria-disabled');
} else {
  disableContactLink(mapLink);
}

if (businessContact.officeAddress) {
  const mapWrapper = document.querySelector('[data-map-wrapper]');
  mapWrapper.hidden = false;
  mapWrapper.querySelector('[data-map-embed]').src = `https://maps.google.com/maps?q=${encodeURIComponent(businessContact.officeAddress)}&output=embed`;
}

menuToggle.addEventListener('click', () => {
  const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
  menuToggle.setAttribute('aria-expanded', String(!expanded));
  menuToggle.setAttribute('aria-label', expanded ? 'Open navigation' : 'Close navigation');
  nav.classList.toggle('open', !expanded);
});

nav.addEventListener('click', (event) => {
  if (event.target.closest('a')) {
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Open navigation');
    nav.classList.remove('open');
  }
});

const requestType = document.querySelector('#request-type');
document.querySelectorAll('[data-enquiry-type]').forEach((link) => {
  link.addEventListener('click', () => {
    requestType.value = link.dataset.enquiryType;
  });
});

async function sendEmail(templateId, templateParams) {
  if (!emailjsReady || !templateId || templateId.startsWith('YOUR_')) {
    throw new Error('EmailJS is not configured.');
  }

  emailjsModule ??= import('https://esm.sh/@emailjs/browser@4');
  const emailjs = await emailjsModule;
  await emailjs.default.send(emailjsConfig.serviceId, templateId, templateParams, {
    publicKey: emailjsConfig.publicKey,
  });
}

const formSettings = [
  {
    id: 'inquiry-form',
    templateKey: 'inquiryTemplateId',
    collectionName: 'inquiries',
    successMessage: 'Thanks. Your project enquiry has been sent.',
    getTemplateParams: (data) => ({
      from_name: String(data.get('name')).trim(),
      reply_to: String(data.get('email')).trim(),
      phone: String(data.get('phone') || '').trim(),
      request_type: String(data.get('requestType') || '').trim(),
      project_type: String(data.get('projectType') || '').trim(),
      site_location: String(data.get('siteLocation') || '').trim(),
      preferred_date: String(data.get('preferredDate') || '').trim(),
      message: String(data.get('message')).trim(),
    }),
  },
  {
    id: 'careers-form',
    templateKey: 'careersTemplateId',
    collectionName: 'applications',
    successMessage: 'Thanks for getting in touch. Your application has been sent.',
    getTemplateParams: (data) => ({
      from_name: String(data.get('name')).trim(),
      reply_to: String(data.get('email')).trim(),
      phone: String(data.get('phone') || '').trim(),
      experience_area: String(data.get('experienceArea') || '').trim(),
      portfolio_url: String(data.get('portfolioUrl') || '').trim(),
      message: String(data.get('message')).trim(),
    }),
  },
];

for (const settings of formSettings) {
  const form = document.getElementById(settings.id);
  if (!form) continue;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = form.querySelector('.form-status');
    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonContent = submitButton.innerHTML;
    const formData = new FormData(form);
    const templateId = emailjsConfig[settings.templateKey];
    const templateParams = settings.getTemplateParams(formData);

    status.classList.remove('error');
    status.textContent = '';
    submitButton.disabled = true;
    submitButton.textContent = 'Sending...';

    try {
      await sendEmail(templateId, templateParams);

      if (database) {
        try {
          await addDoc(collection(database, settings.collectionName), {
            ...templateParams,
            createdAt: serverTimestamp(),
          });
        } catch (archiveError) {
          console.error('Email sent, but Firestore archiving failed:', archiveError);
        }
      }

      form.reset();
      status.textContent = settings.successMessage;
    } catch (error) {
      console.error('Unable to send form email:', error);
      status.textContent = 'We could not send your message. Please try again later.';
      status.classList.add('error');
    } finally {
      submitButton.disabled = false;
      submitButton.innerHTML = originalButtonContent;
    }
  });
}