export type SavedAssemblyMenuNode = {
  key: string;
  label: string;
  formId?: string;
  visible?: boolean;
  defaultEntry?: boolean;
  children?: SavedAssemblyMenuNode[];
};

export type RuntimeDynamicMenu = {
  id: number;
  parent_id: number | null;
  title: string;
  route_path: string;
  icon?: string;
  is_visible: boolean;
  children?: RuntimeDynamicMenu[];
};

export const APP_ASSEMBLY_MENUS_STORAGE_KEY = 'mf_app_assembly_menus';
export const APP_ASSEMBLY_MENU_EVENT = 'mf-app-assembly-menus-updated';

const formRouteMap: Record<string, { route: string; icon: string }> = {
  'production-overview': { route: '/dashboard?view=overview', icon: 'DashboardOutlined' },
  'line-status': { route: '/dashboard?view=lines', icon: 'DashboardOutlined' },
  'device-health': { route: '/maintenance?view=health', icon: 'ToolOutlined' },
  'fault-prediction': { route: '/maintenance?view=prediction', icon: 'ToolOutlined' },
  'maintenance-order': { route: '/maintenance?view=work-orders', icon: 'AppstoreOutlined' },
  'alert-center': { route: '/maintenance?view=alerts', icon: 'SafetyCertificateOutlined' },
  'quality-overview': { route: '/quality?view=overview', icon: 'SafetyCertificateOutlined' },
  'inspection-batch': { route: '/quality?view=inspections', icon: 'SafetyCertificateOutlined' },
  'defect-analysis': { route: '/quality?view=defects', icon: 'SafetyCertificateOutlined' },
  'quality-event': { route: '/quality?view=capa', icon: 'SafetyCertificateOutlined' },
  'supplier-risk': { route: '/supply-chain?view=suppliers', icon: 'ShopOutlined' },
  'supply-overview': { route: '/supply-chain?view=overview', icon: 'ShopOutlined' },
  'material-impact': { route: '/supply-chain?view=materials', icon: 'ShopOutlined' },
  'risk-review': { route: '/supply-chain?view=review', icon: 'SafetyCertificateOutlined' },
};

function numericId(appId: number, key: string): number {
  let hash = appId * 1000;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) % 900000;
  }
  return hash + 10000;
}

export function loadAssemblyMenus(): Record<number, SavedAssemblyMenuNode[]> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(APP_ASSEMBLY_MENUS_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveAssemblyMenus(next: Record<number, SavedAssemblyMenuNode[]>): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(APP_ASSEMBLY_MENUS_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(APP_ASSEMBLY_MENU_EVENT));
}

export function savedAssemblyMenusToDynamicMenus(
  appId: number,
  nodes: SavedAssemblyMenuNode[],
): RuntimeDynamicMenu[] {
  return nodes
    .filter((node) => node.visible !== false)
    .map((node) => {
      const routeInfo = node.formId ? formRouteMap[node.formId] : undefined;
      const children = node.children?.length
        ? savedAssemblyMenusToDynamicMenus(appId, node.children)
        : undefined;

      return {
        id: numericId(appId, node.key),
        parent_id: null,
        title: node.label,
        route_path: routeInfo?.route || (children?.length ? '' : `/dynamic/${node.formId || node.key}`),
        icon: routeInfo?.icon || (children?.length ? 'AppstoreOutlined' : 'DashboardOutlined'),
        is_visible: node.visible !== false,
        children,
      };
    });
}
