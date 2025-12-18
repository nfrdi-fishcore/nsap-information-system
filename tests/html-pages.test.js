const path = require('path');
const { readFileSync } = require('fs');
const { JSDOM } = require('jsdom');

const loadHtml = (relativePath) => {
    const fullPath = path.join(__dirname, '..', relativePath);
    const html = readFileSync(fullPath, 'utf-8');
    return new JSDOM(html).window.document;
};

describe('Sample Day Detail page', () => {
    test('Gear and vessel add buttons render with expected structure', () => {
        const doc = loadHtml('sample-day-detail.html');

        const gearFooterBtn = doc.querySelector('#gearUnloadTableFooter .gear-unload-add-btn');
        expect(gearFooterBtn).not.toBeNull();

        const vesselFooterBtn = doc.querySelector('#vesselUnloadTableFooter .vessel-unload-add-btn');
        expect(vesselFooterBtn).not.toBeNull();

        const vesselFooterCell = vesselFooterBtn?.closest('td');
        expect(vesselFooterCell?.colSpan).toBe(3);
    });

    test('Empty-state vessel unload button class present in JS template', () => {
        const jsPath = path.join(__dirname, '..', 'src', 'assets', 'js', 'modules', 'sample-day-detail.js');
        const jsContent = readFileSync(jsPath, 'utf-8');
        expect(jsContent).toContain('vessel-unload-add-btn');
        expect(jsContent).toContain('handleAddVesselUnload');
    });
});

describe('Vessel Unload Detail page', () => {
    test('Placeholder fields render and show query params placeholders', () => {
        const doc = loadHtml('vessel-unload-detail.html');
        const daySpan = doc.querySelector('#detailUnloadDayId');
        const gearSpan = doc.querySelector('#detailUnloadGrId');
        expect(daySpan).not.toBeNull();
        expect(gearSpan).not.toBeNull();
    });
});

