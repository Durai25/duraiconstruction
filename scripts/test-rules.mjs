import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getBytes, ref, uploadBytes } from 'firebase/storage';

const projectId = 'demo-durai';
const [firestoreRules, storageRules] = await Promise.all([
  readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
  readFile(new URL('../storage.rules', import.meta.url), 'utf8'),
]);

const environment = await initializeTestEnvironment({
  projectId,
  firestore: { rules: firestoreRules },
  storage: { rules: storageRules },
});

try {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'projects/project-alpha'), {
      customerId: 'customer-alpha',
      projectName: 'Alpha Residence',
      workStatus: 'In Progress',
    });
    await uploadBytes(
      ref(context.storage(), 'projects/project-alpha/site-photo.png'),
      new Uint8Array([137, 80, 78, 71]),
      { contentType: 'image/png' },
    );
  });

  const customer = environment.authenticatedContext('customer-alpha');
  const otherCustomer = environment.authenticatedContext('customer-beta');
  const admin = environment.authenticatedContext('administrator', { admin: true });
  const customerProject = doc(customer.firestore(), 'projects/project-alpha');
  const otherProject = doc(otherCustomer.firestore(), 'projects/project-alpha');

  await assertSucceeds(getDoc(customerProject));
  await assertFails(getDoc(otherProject));
  await assertSucceeds(getDocs(query(
    collection(customer.firestore(), 'projects'),
    where('customerId', '==', 'customer-alpha'),
  )));
  await assertFails(getDocs(collection(otherCustomer.firestore(), 'projects')));
  await assertFails(updateDoc(customerProject, { workStatus: 'Completed' }));
  await assertSucceeds(updateDoc(doc(admin.firestore(), 'projects/project-alpha'), { workStatus: 'Completed' }));
  await assertFails(addDoc(collection(customer.firestore(), 'projects/project-alpha/updates'), {
    message: 'Unauthorized update',
    media: [],
    createdAt: serverTimestamp(),
  }));
  await assertSucceeds(addDoc(collection(admin.firestore(), 'projects/project-alpha/updates'), {
    message: 'Admin progress update',
    media: [],
    createdAt: serverTimestamp(),
  }));

  await assertSucceeds(getBytes(ref(customer.storage(), 'projects/project-alpha/site-photo.png')));
  await assertFails(getBytes(ref(otherCustomer.storage(), 'projects/project-alpha/site-photo.png')));
  await assertFails(uploadBytes(
    ref(customer.storage(), 'projects/project-alpha/customer-upload.png'),
    new Uint8Array([1, 2, 3]),
    { contentType: 'image/png' },
  ));
  await assertSucceeds(uploadBytes(
    ref(admin.storage(), 'projects/project-alpha/admin-upload.mp4'),
    new Uint8Array([1, 2, 3]),
    { contentType: 'video/mp4' },
  ));

  console.log('Firestore and Storage ownership/admin rules passed.');
} finally {
  await environment.cleanup();
}
