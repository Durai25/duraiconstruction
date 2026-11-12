const rates = {
  residential: { low: 1800, high: 2600, label: 'Residential Construction' },
  commercial: { low: 2200, high: 3400, label: 'Commercial Construction' },
  industrial: { low: 1600, high: 2600, label: 'Industrial Construction' },
  renovation: { low: 900, high: 1700, label: 'Renovation' },
};
const finishMultipliers = { standard: 1, enhanced: 1.15, premium: 1.3 };
const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
const estimateType = document.querySelector('#estimate-type');
const estimateArea = document.querySelector('#estimate-area');
const estimateFinish = document.querySelector('#estimate-finish');
const estimateLow = document.querySelector('#estimate-low');
const estimateHigh = document.querySelector('#estimate-high');
const estimateRate = document.querySelector('#estimate-rate');
let latestEstimate;
let insertedEstimateNote;

function updateEstimate() {
  const area = Number(estimateArea.value);
  if (!estimateArea.validity.valid || !Number.isFinite(area) || area <= 0) {
    estimateLow.textContent = 'Enter an area';
    estimateHigh.textContent = 'to continue';
    estimateRate.textContent = 'Use an area between 200 and 50,000 sq. ft.';
    latestEstimate = undefined;
    return;
  }

  const rate = rates[estimateType.value];
  const multiplier = finishMultipliers[estimateFinish.value];
  const low = Math.round(area * rate.low * multiplier);
  const high = Math.round(area * rate.high * multiplier);
  estimateLow.textContent = currency.format(low);
  estimateHigh.textContent = currency.format(high);
  estimateRate.textContent = `${area.toLocaleString('en-IN')} sq. ft. · ${rate.label} · ${estimateFinish.options[estimateFinish.selectedIndex].text} finish`;
  latestEstimate = { low, high, area, projectType: rate.label };
}

for (const control of [estimateType, estimateArea, estimateFinish]) {
  control.addEventListener('input', updateEstimate);
  control.addEventListener('change', updateEstimate);
}
updateEstimate();

document.querySelector('#estimate-to-enquiry').addEventListener('click', () => {
  if (!latestEstimate) {
    estimateArea.reportValidity();
    return;
  }

  const inquiryForm = document.querySelector('#inquiry-form');
  inquiryForm.elements.requestType.value = 'Free Quotation Request';
  inquiryForm.elements.projectType.value = latestEstimate.projectType;
  const message = inquiryForm.elements.message;
  if (insertedEstimateNote && message.value.includes(insertedEstimateNote)) {
    message.value = message.value.replace(insertedEstimateNote, '').trim();
  }
  latestEstimate.note = `Website planning estimate: ${currency.format(latestEstimate.low)}–${currency.format(latestEstimate.high)} for ${latestEstimate.area.toLocaleString('en-IN')} sq. ft. ${latestEstimate.projectType.toLowerCase()} (illustrative only).`;
  insertedEstimateNote = latestEstimate.note;
  message.value = [message.value.trim(), latestEstimate.note].filter(Boolean).join('\n\n');
  inquiryForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
  message.focus({ preventScroll: true });
});

const svgNamespace = 'http://www.w3.org/2000/svg';
const scene = document.querySelector('#building-scene');
const modelType = document.querySelector('#model-type');
const modelFloors = document.querySelector('#model-floors');
const modelAngle = document.querySelector('#model-angle');
const modelDescription = document.querySelector('#building-model-description');

const buildingStyles = {
  residential: { width: 58, depth: 38, wall: '#e5d7c2', side: '#c4ae91', roof: '#765748', windowColumns: 3 },
  commercial: { width: 68, depth: 43, wall: '#d6e0df', side: '#9eaeae', roof: '#526b70', windowColumns: 4 },
  industrial: { width: 76, depth: 48, wall: '#d7d4c8', side: '#aaa99a', roof: '#59665d', windowColumns: 3 },
};

function makeSvgElement(name, attributes = {}) {
  const element = document.createElementNS(svgNamespace, name);
  for (const [attribute, value] of Object.entries(attributes)) element.setAttribute(attribute, value);
  return element;
}

function polygon(points, fill, stroke = '#53665a') {
  return makeSvgElement('polygon', {
    points: points.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '),
    fill,
    stroke,
    'stroke-width': '1',
    'stroke-linejoin': 'round',
  });
}

function renderBuilding() {
  const style = buildingStyles[modelType.value];
  const floors = Number(modelFloors.value);
  const floorHeight = 26;
  const height = floors * floorHeight;
  const yaw = (Number(modelAngle.value) * Math.PI) / 180;
  const elevation = Math.PI / 7;
  const scale = 0.94;
  const cosine = Math.cos(yaw);
  const sine = Math.sin(yaw);

  function project(x, y, z) {
    const rotatedX = x * cosine + z * sine;
    const rotatedZ = -x * sine + z * cosine;
    return {
      x: 180 + rotatedX * scale,
      y: 205 - (y * Math.cos(elevation) - rotatedZ * Math.sin(elevation)) * scale,
      depth: rotatedZ,
    };
  }

  scene.replaceChildren();
  const ground = [
    project(-112, 0, -82),
    project(112, 0, -82),
    project(112, 0, 82),
    project(-112, 0, 82),
  ];
  scene.append(polygon(ground, '#dfe5dc', '#c4cec4'));
  scene.append(makeSvgElement('path', {
    d: `M ${project(-112, 0, 0).x} ${project(-112, 0, 0).y} L ${project(112, 0, 0).x} ${project(112, 0, 0).y}`,
    stroke: '#cbd4ca',
    'stroke-width': '1',
  }));

  const sideSign = yaw < 0 ? -1 : 1;
  const frontZ = style.depth;
  const sideX = sideSign * style.width;
  const frontFace = {
    depth: project(0, height / 2, frontZ).depth,
    points: [
      [-style.width, 0, frontZ],
      [style.width, 0, frontZ],
      [style.width, height, frontZ],
      [-style.width, height, frontZ],
    ],
    fill: style.wall,
    windows: [],
  };
  const sideFace = {
    depth: project(sideX, height / 2, 0).depth,
    points: [
      [sideX, 0, -style.depth],
      [sideX, 0, style.depth],
      [sideX, height, style.depth],
      [sideX, height, -style.depth],
    ],
    fill: style.side,
    windows: [],
  };
  const windowWidth = 12;
  const windowHeight = 10;

  for (let floor = 0; floor < floors; floor += 1) {
    const bottom = floor * floorHeight + 8;
    for (let column = 1; column <= style.windowColumns; column += 1) {
      const x = -style.width + (2 * style.width * column) / (style.windowColumns + 1);
      frontFace.windows.push([
        [x - windowWidth / 2, bottom, frontZ + 0.2],
        [x + windowWidth / 2, bottom, frontZ + 0.2],
        [x + windowWidth / 2, bottom + windowHeight, frontZ + 0.2],
        [x - windowWidth / 2, bottom + windowHeight, frontZ + 0.2],
      ]);
    }

    for (let column = 1; column <= 2; column += 1) {
      const z = -style.depth + (2 * style.depth * column) / 3;
      sideFace.windows.push([
        [sideX + sideSign * 0.2, bottom, z - windowWidth / 2],
        [sideX + sideSign * 0.2, bottom, z + windowWidth / 2],
        [sideX + sideSign * 0.2, bottom + windowHeight, z + windowWidth / 2],
        [sideX + sideSign * 0.2, bottom + windowHeight, z - windowWidth / 2],
      ]);
    }
  }

  if (modelType.value === 'residential') {
    frontFace.windows.push([
      [-8, 0, frontZ + 0.3],
      [8, 0, frontZ + 0.3],
      [8, 19, frontZ + 0.3],
      [-8, 19, frontZ + 0.3],
    ]);
  }

  for (const face of [frontFace, sideFace].sort((left, right) => left.depth - right.depth)) {
    scene.append(polygon(face.points.map(([x, y, z]) => project(x, y, z)), face.fill));
    for (const window of face.windows) {
      scene.append(polygon(window.map(([x, y, z]) => project(x, y, z)), '#52717b', '#e9e4d8'));
    }
  }

  const roofOverhang = 7;
  const roof = [
    project(-style.width - roofOverhang, height, -style.depth - roofOverhang),
    project(style.width + roofOverhang, height, -style.depth - roofOverhang),
    project(style.width + roofOverhang, height, style.depth + roofOverhang),
    project(-style.width - roofOverhang, height, style.depth + roofOverhang),
  ];
  scene.append(polygon(roof, style.roof, '#4e594f'));

  if (modelType.value === 'residential') {
    const ridge = height + 18;
    const rise = [
      project(-style.width, height, frontZ),
      project(0, ridge, frontZ),
      project(style.width, height, frontZ),
    ];
    scene.append(polygon(rise, style.roof, '#4e594f'));
    const backGable = [
      project(-style.width, height, -frontZ),
      project(0, ridge, -frontZ),
      project(style.width, height, -frontZ),
    ];
    scene.append(polygon(backGable, style.side, '#4e594f'));
  }

  document.querySelector('#model-floors-value').textContent = `${floors}`;
  document.querySelector('#model-angle-value').textContent = `${modelAngle.value}°`;
  modelDescription.textContent = `${modelType.options[modelType.selectedIndex].text} concept with ${floors} floor${floors === 1 ? '' : 's'}, viewed at ${modelAngle.value} degrees.`;
}

for (const control of [modelType, modelFloors, modelAngle]) {
  control.addEventListener('input', renderBuilding);
  control.addEventListener('change', renderBuilding);
}
renderBuilding();

const planUse = document.querySelector('#plan-use');
const planRooms = document.querySelector('#plan-rooms');
const planRoomsLabel = document.querySelector('#plan-rooms-label');
const planWidth = document.querySelector('#plot-width');
const planDepth = document.querySelector('#plot-depth');
const planParking = document.querySelector('#plan-parking');
const planEntry = document.querySelector('#plan-entry');
const planPriorities = document.querySelector('#plan-priorities');
const planScene = document.querySelector('#floor-plan-scene');
const planSummary = document.querySelector('#plan-summary');
const planDescription = document.querySelector('#floor-plan-description');
const createPlanButton = document.querySelector('#create-floor-plan');
const planGenerationStatus = document.querySelector('#plan-generation-status');

function renderFloorPlan() {
  const width = Math.max(15, Math.min(300, Number(planWidth.value) || 40));
  const depth = Math.max(15, Math.min(300, Number(planDepth.value) || 60));
  const count = Number(planRooms.value);
  const use = planUse.value;
  const roomNames = use === 'home'
    ? ['Living', 'Kitchen', ...Array.from({ length: count }, (_, index) => `Bedroom ${index + 1}`), 'Bath', 'Dining']
    : use === 'rental'
      ? ['Living / dining', 'Kitchen', ...Array.from({ length: count }, (_, index) => `Unit ${index + 1}`), 'Shared bath', 'Stair']
      : use === 'office'
        ? ['Reception', 'Open office', ...Array.from({ length: count }, (_, index) => `Office ${index + 1}`), 'Meeting', 'Services']
        : use === 'retail'
          ? ['Sales floor', 'Display', ...Array.from({ length: count }, (_, index) => `Shop ${index + 1}`), 'Store', 'WC']
          : ['Shop / reception', 'Living / office', ...Array.from({ length: count }, (_, index) => `Room ${index + 1}`), 'Kitchen', 'Services'];
  if (planParking.value !== 'none') roomNames.push(`${planParking.value} car parking`);

  const left = 68;
  const top = 42;
  const planW = 384;
  const planH = 236;
  const columns = Math.ceil(Math.sqrt(roomNames.length * (planW / planH)));
  const rows = Math.ceil(roomNames.length / columns);
  const cellW = planW / columns;
  const cellH = planH / rows;
  planScene.replaceChildren();
  planScene.append(makeSvgElement('rect', { x: 50, y: 34, width: 420, height: 254, fill: 'none', stroke: '#9aa69b', 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }));
  planScene.append(makeSvgElement('rect', { x: left, y: top, width: planW, height: planH, fill: '#fbfcf8', stroke: '#18372f', 'stroke-width': 5 }));

  for (let index = 1; index < columns; index += 1) {
    planScene.append(makeSvgElement('line', { x1: left + index * cellW, y1: top, x2: left + index * cellW, y2: top + planH, stroke: '#53665a', 'stroke-width': 2 }));
  }
  for (let index = 1; index < rows; index += 1) {
    planScene.append(makeSvgElement('line', { x1: left, y1: top + index * cellH, x2: left + planW, y2: top + index * cellH, stroke: '#53665a', 'stroke-width': 2 }));
  }
  roomNames.forEach((name, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const text = makeSvgElement('text', { x: left + col * cellW + cellW / 2, y: top + row * cellH + cellH / 2, fill: '#263c34', 'font-size': cellW < 100 ? 9 : 11, 'font-family': 'sans-serif', 'text-anchor': 'middle', 'dominant-baseline': 'middle' });
    text.textContent = name;
    planScene.append(text);
  });
  planScene.append(makeSvgElement('line', { x1: left, y1: 302, x2: left + planW, y2: 302, stroke: '#8b958d', 'stroke-width': 1 }));
  const widthLabel = makeSvgElement('text', { x: left + planW / 2, y: 320, fill: '#53665a', 'font-size': 11, 'font-family': 'sans-serif', 'text-anchor': 'middle' });
  widthLabel.textContent = `${width} ft plot width`;
  planScene.append(widthLabel);
  const depthLabel = makeSvgElement('text', { x: 28, y: top + planH / 2, fill: '#53665a', 'font-size': 11, 'font-family': 'sans-serif', 'text-anchor': 'middle', transform: `rotate(-90 28 ${top + planH / 2})` });
  depthLabel.textContent = `${depth} ft plot depth`;
  planScene.append(depthLabel);
  const entryX = planEntry.value === 'Left' ? left : planEntry.value === 'Right' ? left + planW : left + planW / 2;
  const entryY = planEntry.value === 'Rear' ? top : planEntry.value === 'Front' ? top + planH : top + planH / 2;
  planScene.append(makeSvgElement('circle', { cx: entryX, cy: entryY, r: 7, fill: '#e87531', stroke: '#fff', 'stroke-width': 2 }));
  const entryLabel = makeSvgElement('text', { x: entryX, y: entryY - 12, fill: '#9c4d20', 'font-size': 9, 'font-family': 'sans-serif', 'text-anchor': 'middle' });
  entryLabel.textContent = `${planEntry.value} entry`;
  planScene.append(entryLabel);
  const useName = planUse.options[planUse.selectedIndex].text;
  planSummary.textContent = `${count} ${planRoomsLabel.textContent.toLowerCase()} · ${useName} · ${width} × ${depth} ft plot`;
  if (planPriorities.value.trim()) planSummary.textContent += ` · Priority: ${planPriorities.value.trim()}`;
  planDescription.textContent = `Approximate ground-floor ${useName.toLowerCase()} layout on a ${width} by ${depth} foot plot, with ${roomNames.join(', ')}.`;
}

planUse.addEventListener('change', () => {
  const commercial = planUse.value !== 'home' && planUse.value !== 'rental';
  planRoomsLabel.textContent = commercial ? 'Private rooms' : planUse.value === 'rental' ? 'Rental units' : 'Bedrooms';
  renderFloorPlan();
});
for (const control of [planRooms, planWidth, planDepth, planParking, planPriorities, planEntry]) {
  control.addEventListener('input', renderFloorPlan);
  control.addEventListener('change', renderFloorPlan);
}
renderFloorPlan();

createPlanButton.addEventListener('click', () => {
  renderBuilding();
  renderFloorPlan();
  planGenerationStatus.textContent = 'Your concept is ready in the preview.';
  conceptDialog.showModal();
  selectConceptView('2d');
  document.querySelector('#show-2d-view').focus();
});

const show2dView = document.querySelector('#show-2d-view');
const show3dView = document.querySelector('#show-3d-view');
const panel2d = document.querySelector('#viewer-2d-panel');
const panel3d = document.querySelector('#viewer-3d-panel');
const conceptDialog = document.querySelector('#concept-dialog');

const previewElements = [document.querySelector('.plan-preview-heading'), document.querySelector('#floor-plan'), document.querySelector('.plan-disclaimer')];
panel2d.append(...previewElements);
previewElements.forEach((element) => { element.hidden = false; });
conceptDialog.append(panel3d);

function selectConceptView(view) {
  const show2d = view === '2d';
  panel2d.hidden = !show2d;
  panel3d.hidden = show2d;
  show2dView.setAttribute('aria-selected', String(show2d));
  show3dView.setAttribute('aria-selected', String(!show2d));
}

show2dView.addEventListener('click', () => selectConceptView('2d'));
show3dView.addEventListener('click', () => selectConceptView('3d'));
document.querySelector('#close-concept-dialog').addEventListener('click', () => conceptDialog.close());
conceptDialog.addEventListener('click', (event) => {
  if (event.target === conceptDialog) conceptDialog.close();
});
