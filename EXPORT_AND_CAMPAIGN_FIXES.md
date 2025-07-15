# Export and Campaign Generation Fixes

## Changes Made

### 1. Export Functionality Standardization

#### Inventory Actions Table
- Replaced single JSON export button with `ExportDropdown` component in detail sheet
- Added support for CSV, Excel, and JSON export formats
- Added table-level export functionality to export all recommendations

#### Campaign Detail Sheet
- Replaced single JSON export button with `ExportDropdown` component
- Added support for CSV, Excel, and JSON export formats
- Properly formatted export data for campaigns

#### Table-Level Exports
- Added export buttons to all 4 main tabs (trends, catalog, inventory, campaigns)
- Each table now has a dedicated export button that exports the entire dataset
- Export buttons use the same `ExportDropdown` component for consistency

### 2. Campaign Generation Fixes

#### Individual Trend Campaign Generation
- Added loading state to the campaign generation button in trend detail sheet
- Button now shows spinner while generating
- Properly disabled during generation to prevent multiple clicks
- Shows success toast with campaign name when complete

#### Main Campaign Generation
- Fixed missing `bundle_criteria` and `bundle_reasons` fields in campaign creation
- Updated both `/api/campaigns/generate` and `/api/campaigns/generate-single` endpoints
- Campaigns now properly store bundling information

### 3. Technical Implementation Details

#### Updated Components
1. `components/inventory-actions-table.tsx`
   - Added `getData()` method to ref for table-level export
   - Updated detail sheet to use `ExportDropdown`

2. `components/campaign-table.tsx`
   - Added `getData()` method to ref for table-level export
   - Updated detail sheet to use `ExportDropdown`
   - Fixed import path for `useCredits`

3. `components/data-table-trends.tsx`
   - Added export buttons for inventory and campaigns tabs
   - Added loading state to individual trend campaign generation
   - Fixed TypeScript errors in map functions

4. `app/api/campaigns/generate/route.ts`
   - Added `bundle_criteria` and `bundle_reasons` to campaign insert
   - Fixed `target_demographics` → `target_audience` field name

5. `app/api/campaigns/generate-single/route.ts`
   - Added `bundle_criteria` and `bundle_reasons` to campaign insert
   - Fixed `target_demographics` → `target_audience` field name

### 4. Export Data Formatting

Each export type has proper formatting:
- **Recommendations**: Includes product info, action, trend, scores, reasons
- **Campaigns**: Includes campaign details, budget, target audience, products
- **Products**: Full product details with inventory and performance metrics
- **Trends**: Complete trend information with demographics and metrics

## Testing

1. Test inventory actions export:
   - Click export button in inventory tab
   - Try all three formats (CSV, Excel, JSON)
   - Export individual recommendation from detail sheet

2. Test campaign export:
   - Click export button in campaigns tab
   - Try all three formats
   - Export individual campaign from detail sheet

3. Test campaign generation:
   - Click rocket icon in trend detail sheet
   - Verify loading state appears
   - Check that campaign is created
   - Click main "Generate Campaigns" button
   - Verify multiple campaigns are created

## Notes

- All exports use the centralized export utilities in `/lib/export-utils.ts`
- Export filenames include the current date for organization
- Loading states prevent duplicate submissions
- Success/error toasts provide user feedback 