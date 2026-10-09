import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }
export function dateLabel(value: string) { return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(new Date(value)) }
export function timeLabel(value: string) { return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value)) }
export function bytes(value: number) { if (value < 1024) return `${value} B`; if (value < 1048576) return `${(value / 1024).toFixed(1)} KB`; return `${(value / 1048576).toFixed(1)} MB` }
export const categoryLabels = { gaming: '游戏', work: '工作', other: '其他' }
export const jobLabels: Record<string, string> = { initialize: '初始化 Bottle', import: '导入 Bottle', run: '启动程序', winecfg: 'Wine 配置', regedit: '注册表编辑器', uninstaller: '卸载程序', windows: '切换 Windows 版本', winetricks: '安装依赖', stop: '停止 Bottle' }
