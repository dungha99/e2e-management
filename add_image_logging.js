const fs = require('fs');

const filePath = 'd:\\Antigravity\\projects\\minh-thu-decoy-campaign-manager\\components\\e2e-management.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Add logging before the Car Images section
const oldCarImagesSection = `              {/* Car Images */}
              {selectedLead.additional_images && (`;

const newCarImagesSection = `              {/* Car Images */}
              {(() => {
                console.log('[IMAGE SECTION] About to check if should display images');
                console.log('[IMAGE SECTION] selectedLead.additional_images:', selectedLead.additional_images);
                console.log('[IMAGE SECTION] Type:', typeof selectedLead.additional_images);
                return true; // Always show section for debugging
              })() && selectedLead.additional_images && (`;

content = content.replace(oldCarImagesSection, newCarImagesSection);

// Save the file
fs.writeFileSync(filePath, content, 'utf8');

console.log('Successfully added logging before Car Images section');
