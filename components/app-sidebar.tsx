"use client"

import type * as React from "react"
import {
  ArrowUpCircleIcon,
  BarChartIcon,
  CameraIcon,
  ClipboardListIcon,
  DatabaseIcon,
  FileCodeIcon,
  FileIcon,
  FileTextIcon,
  FolderIcon,
  HelpCircleIcon,
  LayoutDashboardIcon,
  ListIcon,
  SearchIcon,
  SettingsIcon,
  ShoppingBagIcon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react"

import { NavDocuments } from "./nav-documents"
import { NavMain } from "./nav-main"
import { NavSecondary } from "./nav-secondary"
import { NavUser } from "./nav-user"
import { CreditsWidget } from "./credits-widget"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
} from "@/components/ui/sidebar"
import { useTranslation } from 'react-i18next'

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { t } = useTranslation()
  
  const data = {
    user: {
      name: "johndoe",
      email: "john@example.com",
      avatar: "/avatars/shadcn.jpg",
    },
    navMain: [
      {
        title: t('navigation.dashboard'),
        url: "#",
        icon: LayoutDashboardIcon,
      },
      {
        title: t('navigation.trendSignals'),
        url: "#",
        icon: TrendingUpIcon,
      },
      {
        title: t('navigation.analytics'),
        url: "#",
        icon: BarChartIcon,
      },
      {
        title: t('navigation.catalog'),
        url: "#",
        icon: ShoppingBagIcon,
      },
      {
        title: t('navigation.team'),
        url: "#",
        icon: UsersIcon,
      },
    ],
    navClouds: [
      {
        title: t('navigation.trendInsights'),
        icon: CameraIcon,
        isActive: true,
        url: "#",
        items: [
          {
            title: t('navigation.activeTrends'),
            url: "#",
          },
          {
            title: t('navigation.archived'),
            url: "#",
          },
        ],
      },
      {
        title: t('navigation.catalogMatching'),
        icon: FileTextIcon,
        url: "#",
        items: [
          {
            title: t('navigation.matchedProducts'),
            url: "#",
          },
          {
            title: t('navigation.pendingMatches'),
            url: "#",
          },
        ],
      },
      {
        title: t('navigation.recommendations'),
        icon: FileCodeIcon,
        url: "#",
        items: [
          {
            title: t('navigation.promotionOpportunities'),
            url: "#",
          },
          {
            title: t('navigation.restockAlerts'),
            url: "#",
          },
        ],
      },
    ],
    navSecondary: [
      {
        title: t('navigation.settings'),
        url: "#",
        icon: SettingsIcon,
      },
      {
        title: t('navigation.help'),
        url: "#",
        icon: HelpCircleIcon,
      },
      {
        title: t('navigation.search'),
        url: "#",
        icon: SearchIcon,
      },
    ],
    documents: [
      {
        name: t('navigation.trendLibrary'),
        url: "#",
        icon: DatabaseIcon,
      },
      {
        name: t('navigation.reports'),
        url: "#",
        icon: ClipboardListIcon,
      },
      {
        name: t('navigation.trendInsights'),
        url: "#",
        icon: FileIcon,
      },
    ],
  }

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:!p-1.5">
              <a href="#">
                <img src="/looki-logo-full.png" alt="Looki" className="h-8 w-auto" />
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <NavMain items={data.navMain} />
          <NavDocuments items={data.documents} />
          <NavSecondary items={data.navSecondary} className="mt-auto" />
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <CreditsWidget />
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
