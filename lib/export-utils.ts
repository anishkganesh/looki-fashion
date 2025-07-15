import * as XLSX from 'xlsx'
import Papa from 'papaparse'

export type ExportFormat = 'json' | 'csv' | 'excel'

interface ExportOptions {
  filename: string
  format: ExportFormat
  data: any[]
}

// Helper function to flatten nested objects
function flattenObject(obj: any, prefix = ''): any {
  return Object.keys(obj).reduce((acc: any, key) => {
    const pre = prefix.length ? `${prefix}_` : ''
    if (obj[key] === null || obj[key] === undefined) {
      acc[pre + key] = ''
    } else if (typeof obj[key] === 'object' && !Array.isArray(obj[key]) && !(obj[key] instanceof Date)) {
      Object.assign(acc, flattenObject(obj[key], pre + key))
    } else if (Array.isArray(obj[key])) {
      // For arrays, join them as comma-separated values
      acc[pre + key] = obj[key].map((item: any) => 
        typeof item === 'object' ? JSON.stringify(item) : item
      ).join(', ')
    } else {
      acc[pre + key] = obj[key]
    }
    return acc
  }, {})
}

// Prepare data for CSV/Excel export by flattening nested structures
function prepareDataForExport(data: any[]): any[] {
  return data.map(item => flattenObject(item))
}

export function exportData({ filename, format, data }: ExportOptions) {
  if (!data || data.length === 0) {
    throw new Error('No data to export')
  }

  switch (format) {
    case 'json':
      exportJSON(data, filename)
      break
    case 'csv':
      exportCSV(data, filename)
      break
    case 'excel':
      exportExcel(data, filename)
      break
    default:
      throw new Error(`Unsupported export format: ${format}`)
  }
}

function exportJSON(data: any[], filename: string) {
  const jsonString = JSON.stringify(data, null, 2)
  const blob = new Blob([jsonString], { type: 'application/json' })
  downloadFile(blob, `${filename}.json`)
}

function exportCSV(data: any[], filename: string) {
  const flatData = prepareDataForExport(data)
  const csv = Papa.unparse(flatData, {
    header: true,
    skipEmptyLines: true
  })
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  downloadFile(blob, `${filename}.csv`)
}

function exportExcel(data: any[], filename: string) {
  const flatData = prepareDataForExport(data)
  
  // Create a new workbook
  const wb = XLSX.utils.book_new()
  
  // Convert data to worksheet
  const ws = XLSX.utils.json_to_sheet(flatData)
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Data')
  
  // Generate Excel file
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  
  downloadFile(blob, `${filename}.xlsx`)
}

function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Specialized export functions for different data types
export function exportTrends(trends: any[], format: ExportFormat = 'json') {
  const trendsData = trends.map(trend => ({
    trend_id: trend.trend_id,
    trend_name: trend.trend_identifier,
    category: trend.trend_category,
    description: trend.trend_description,
    region: trend.trend_region,
    status: trend.lifecycle_stage,
    momentum_score: trend.momentum_score,
    velocity: trend.velocity,
    adoption_rate: trend.adoption_rate,
    social_reach: trend.social_reach,
    conversion_impact: trend.conversion_impact,
    risk_score: trend.risk_score,
    competitor_brands: trend.competitor_adoption?.brands?.join(', ') || '',
    competitor_adoption_percentage: trend.competitor_adoption?.percentage || 0,
    predicted_peak_date: trend.predicted_peak_date,
    predicted_decline_date: trend.predicted_decline_date,
    target_age: `${trend.target_age_min || 18}-${trend.target_age_max || 65}`,
    target_gender: trend.target_gender || 'All',
    created_at: trend.created_at,
    last_updated: trend.last_updated
  }))
  
  exportData({
    filename: `trends_${new Date().toISOString().split('T')[0]}`,
    format,
    data: trendsData
  })
}

export function exportProducts(products: any[], format: ExportFormat = 'json') {
  const productsData = products.map(product => ({
    product_id: product.product_id,
    sku: product.variant_sku || product.product_code,
    product_name: product.product_name,
    category: product.category_hierarchy || product.category,
    brand_id: product.brand_id,
    current_price: product.current_price,
    original_price: product.original_price,
    discount_percentage: product.discount_percentage || 0,
    currency: product.currency,
    stock_status: product.stock_status,
    inventory_level: product.current_inventory_level,
    days_of_supply: product.days_of_supply,
    color: product.color,
    size: product.size,
    material: product.material,
    revenue_30d: product.revenue_last_30d,
    units_sold_30d: product.units_sold_last_30d,
    inventory_velocity: product.inventory_velocity,
    conversion_rate: product.conversion_rate,
    return_rate: product.return_rate,
    margin_percentage: product.margin_percentage,
    created_at: product.created_at,
    updated_at: product.updated_at
  }))
  
  exportData({
    filename: `products_${new Date().toISOString().split('T')[0]}`,
    format,
    data: productsData
  })
}

export function exportRecommendations(recommendations: any[], format: ExportFormat = 'json') {
  const recommendationsData = recommendations.map(rec => ({
    recommendation_id: rec.recommendation_id,
    product_name: rec.product?.product_name || 'Unknown',
    product_sku: rec.product?.product_code || 'N/A',
    action: rec.recommendation_action,
    trend_matched: rec.trend?.trend_identifier || 'N/A',
    alignment_score: rec.alignment_score,
    confidence_score: (rec.confidence_score * 100).toFixed(0) + '%',
    expected_impact: rec.expected_impact,
    priority: rec.priority,
    reasons: rec.reasons?.map((r: any) => r.reason_description).join('; ') || '',
    is_applied: rec.is_applied ? 'Yes' : 'No',
    applied_at: rec.applied_at || '',
    created_at: rec.created_at
  }))
  
  exportData({
    filename: `recommendations_${new Date().toISOString().split('T')[0]}`,
    format,
    data: recommendationsData
  })
}

export function exportCampaigns(campaigns: any[], format: ExportFormat = 'json') {
  const campaignsData = campaigns.map(campaign => ({
    campaign_id: campaign.campaign_id,
    campaign_name: campaign.campaign_name,
    description: campaign.campaign_description,
    status: campaign.status,
    trend_name: campaign.trend?.trend_identifier || 'N/A',
    social_reach: campaign.social_reach || campaign.trend?.social_reach || 0,
    budget_min: campaign.budget_min,
    budget_max: campaign.budget_max,
    budget_reasoning: campaign.budget_reasoning,
    target_audience: campaign.target_audience,
    marketing_copy: campaign.marketing_copy,
    hashtags: campaign.hashtags?.join(', ') || '',
    content_suggestions: campaign.content_suggestions?.join('; ') || '',
    success_prediction: campaign.success_prediction,
    products: campaign.products?.map((p: any) => p.product_name).join(', ') || '',
    product_count: campaign.products?.length || 0,
    is_applied: campaign.is_applied ? 'Yes' : 'No',
    performance_impressions: campaign.performance_metrics?.impressions || 0,
    performance_clicks: campaign.performance_metrics?.clicks || 0,
    performance_conversions: campaign.performance_metrics?.conversions || 0,
    performance_revenue: campaign.performance_metrics?.revenue || 0,
    performance_roi: campaign.performance_metrics?.roi || 0,
    created_at: campaign.created_at,
    updated_at: campaign.updated_at
  }))
  
  exportData({
    filename: `campaigns_${new Date().toISOString().split('T')[0]}`,
    format,
    data: campaignsData
  })
} 