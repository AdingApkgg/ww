export type BottleStatus = 'creating' | 'ready' | 'error' | 'interrupted'
export type JobStatus = 'running' | 'succeeded' | 'failed' | 'interrupted' | 'cancelled'
export type Category = 'gaming' | 'work' | 'other'
export type BottleColor = 'fern' | 'amber' | 'blue' | 'rose'
export type WindowsVersion = 'win10' | 'win11' | 'win7'
export interface BottleInput { name: string; description: string; category: Category; color: BottleColor; windows: WindowsVersion }
export interface Bottle extends BottleInput { id: string; status: BottleStatus; favorite: boolean; createdAt: string }
export interface Program { id: string; bottleId: string; name: string; path: string; args: string[]; createdAt: string }
export interface Job { id: string; bottleId: string; kind: string; command: string[]; status: JobStatus; log: string; exitCode: number | null; createdAt: string; finishedAt: string | null }
export interface FileEntry { name: string; path: string; directory: boolean; size: number; executable: boolean }
export interface Probe { available: boolean; path: string; version: string; error: string | null }
export interface Health { wine: Probe; wineserver: Probe; winetricks: Probe; platform: string; arch: string; dataDir: string; desktop: boolean; authenticated: boolean; authRequired: boolean }
export interface State { bottles: Bottle[]; programs: Program[]; jobs: Omit<Job, 'log'>[]; health: Health }
export const dependencyOptions = [
  { id: 'vcrun2022', name: 'Visual C++ 2022', description: '常见应用与游戏的 C++ 运行库' },
  { id: 'corefonts', name: '微软核心字体', description: '改善文字显示与字体兼容性' },
  { id: 'd3dx9', name: 'DirectX 9', description: '部分经典游戏需要的 DirectX 组件' },
  { id: 'dotnet48', name: '.NET Framework 4.8', description: '依赖传统 .NET Framework 的应用' },
] as const
