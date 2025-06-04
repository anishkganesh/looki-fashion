"use client"

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { ArrowUpDown, ChevronDown, MoreHorizontal, Search, Package, DollarSign, Hash, Image as ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import { ProductDetailsPanel } from "./product-details-panel"

export type Product = {
  product_id: number
  product_code: string
  product_name: string
  current_price: number
  original_price: number
  discount_percentage: number
  currency: string
  stock_status: string
  current_inventory_level: number
  category?: string
  color?: string
  images?: string[]
}

export function DataTableCatalog() {
  const { user } = useAuth()
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})
  const [data, setData] = React.useState<Product[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selectedProduct, setSelectedProduct] = React.useState<Product | null>(null)

  // Fetch products
  React.useEffect(() => {
    const fetchProducts = async () => {
      if (!user) return

      try {
        // Get user's brand
        const { data: userData } = await supabase
          .from('usr')
          .select('brand_id')
          .eq('email', user.email)
          .single()

        if (!userData?.brand_id) return

        // Fetch products with categories and colors
        const { data: products, error } = await supabase
          .from('products')
          .select(`
            *,
            product_categories (
              category_name,
              category_path
            ),
            product_colors (
              color_name,
              is_primary
            ),
            product_images (
              image_url,
              is_primary,
              image_order
            )
          `)
          .eq('brand_id', userData.brand_id)
          .eq('is_active', true)
          .order('created_at', { ascending: false })

        if (error) {
          console.error('Error fetching products:', error)
          return
        }

        // Transform data
        const transformedProducts = products?.map(product => ({
          ...product,
          category: product.product_categories?.[0]?.category_name || 'Uncategorized',
          color: product.product_colors?.find((c: any) => c.is_primary)?.color_name || 
                 product.product_colors?.[0]?.color_name || 'N/A',
          images: product.product_images
            ?.sort((a: any, b: any) => a.image_order - b.image_order)
            ?.map((img: any) => img.image_url) || []
        })) || []

        setData(transformedProducts)
      } catch (error) {
        console.error('Error fetching products:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [user])

  const columns: ColumnDef<Product>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "product_code",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <Hash className="mr-2 h-4 w-4" />
            SKU
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => (
        <div className="font-mono text-sm">{row.getValue("product_code")}</div>
      ),
    },
    {
      accessorKey: "product_name",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <Package className="mr-2 h-4 w-4" />
            Product
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const product = row.original
        return (
          <div className="flex items-center gap-3">
            {product.images && product.images[0] && (
              <img 
                src={product.images[0]} 
                alt={product.product_name}
                className="w-10 h-10 object-cover rounded"
              />
            )}
            <div className="max-w-[300px]">
              <div className="font-medium truncate">{product.product_name}</div>
              {product.color !== 'N/A' && (
                <div className="text-xs text-muted-foreground">Color: {product.color}</div>
              )}
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => {
        const category = row.getValue("category") as string
        const categoryColors: Record<string, { from: string; to: string }> = {
          "Clothing": { from: "rgb(168, 85, 247)", to: "rgb(236, 72, 153)" },
          "Shoes": { from: "rgb(59, 130, 246)", to: "rgb(6, 182, 212)" },
          "Accessories": { from: "rgb(34, 197, 94)", to: "rgb(16, 185, 129)" },
          "Uncategorized": { from: "rgb(107, 114, 128)", to: "rgb(71, 85, 105)" }
        }
        
        // Get the color config, defaulting to Uncategorized if not found
        const colorConfig = categoryColors[category] || categoryColors["Uncategorized"]
        
        return (
          <Badge 
            variant="outline" 
            className="relative overflow-hidden border-0 bg-gradient-to-r text-white px-3 py-1"
            style={{
              backgroundImage: `linear-gradient(to right, ${colorConfig.from}, ${colorConfig.to})`
            }}
          >
            {category}
          </Badge>
        )
      },
    },
    {
      accessorKey: "current_price",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <DollarSign className="mr-2 h-4 w-4" />
            Price
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const price = parseFloat(row.getValue("current_price"))
        const originalPrice = row.original.original_price
        const discount = row.original.discount_percentage
        const currency = row.original.currency
        
        return (
          <div className="space-y-1">
            <div className="font-medium">
              {currency === 'USD' ? '$' : currency} {price.toFixed(2)}
            </div>
            {discount > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="line-through text-muted-foreground">
                  ${originalPrice.toFixed(2)}
                </span>
                <Badge variant="destructive" className="text-xs">
                  -{discount}%
                </Badge>
              </div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "stock_status",
      header: "Stock",
      cell: ({ row }) => {
        const status = row.getValue("stock_status") as string
        const inventory = row.original.current_inventory_level
        
        return (
          <div className="space-y-1">
            <Badge 
              variant={status === "InStock" ? "default" : "secondary"}
              className={status === "InStock" ? "bg-green-500 text-white hover:bg-green-600" : ""}
            >
              {status}
            </Badge>
            {inventory > 0 && (
              <div className="text-xs text-muted-foreground">
                {inventory} units
              </div>
            )}
          </div>
        )
      },
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const product = row.original

        return (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedProduct(product)}
          >
            View Details
          </Button>
        )
      },
    },
  ]

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  })

  if (loading) {
    return <div className="text-center py-10">Loading catalog...</div>
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={(table.getColumn("product_name")?.getFilterValue() as string) ?? ""}
              onChange={(event) =>
                table.getColumn("product_name")?.setFilterValue(event.target.value)
              }
              className="pl-8"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="ml-auto">
                Columns <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No products found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
      
      {/* Product Details Panel */}
      {selectedProduct && (
        <ProductDetailsPanel
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  )
} 