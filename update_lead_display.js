const fs = require('fs');

const filePath = 'd:\\Antigravity\\projects\\minh-thu-decoy-campaign-manager\\components\\e2e-management.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update formatCarInfo function to include mileage
const oldFormatCarInfo = `function formatCarInfo(lead: Lead): string {
    const parts = []
    if (lead.brand) parts.push(lead.brand)
    if (lead.model) parts.push(lead.model)
    if (lead.variant) parts.push(lead.variant)
    if (lead.year) parts.push(lead.year.toString())
    return parts.length > 0 ? parts.join(" ") : "N/A"
  }`;

const newFormatCarInfo = `function formatCarInfo(lead: Lead): string {
    const parts = []
    if (lead.brand) parts.push(lead.brand)
    if (lead.model) parts.push(lead.model)
    if (lead.variant) parts.push(lead.variant)
    if (lead.year) parts.push(lead.year.toString())
    if (lead.mileage) parts.push(\`\${lead.mileage.toLocaleString()}km\`)
    return parts.length > 0 ? parts.join(" ") : "N/A"
  }`;

content = content.replace(oldFormatCarInfo, newFormatCarInfo);

// 2. Add car created time display - find the line with formatCarInfo and add car created time after it
// Looking for the pattern in the lead list item where we display car info
const oldLeadDisplay = `<p className="text-sm text-gray-700 truncate">
                          {formatCarInfo(lead)}
                        </p>
                        <p className="text-xs text-emerald-600 font-semibold mt-1">
                          {lead.price_customer ? formatPrice(lead.price_customer) : "Chưa có giá"}
                        </p>`;

const newLeadDisplay = `<div className="flex items-center gap-2">
                          <p className="text-sm text-gray-700 truncate">
                            {formatCarInfo(lead)}
                          </p>
                          {lead.car_created_at && (
                            <p className="text-xs text-gray-500 shrink-0">
                              {new Date(lead.car_created_at).toLocaleDateString("vi-VN")}
                            </p>
                          )}
                        </div>
                        <p className="text-xs text-emerald-600 font-semibold mt-1">
                          {lead.price_customer ? formatPrice(lead.price_customer) : "Chưa có giá"}
                        </p>`;

content = content.replace(oldLeadDisplay, newLeadDisplay);

// Save the file
fs.writeFileSync(filePath, content, 'utf8');

console.log('Successfully updated formatCarInfo and added car created time display');
