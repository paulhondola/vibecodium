import {
    FileCode, FileJson, FileText, Folder, FolderOpen,
    Trash2, ChevronRight, ChevronDown, FilePlus, FolderPlus, Pencil,
} from "lucide-react";
import type { ProjectFile } from "./Workspace";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";

interface FileExplorerProps {
    files: ProjectFile[];
    activeFile: ProjectFile | null;
    onSelect: (file: ProjectFile) => void;
    projectId: string | null;
    token: string | null;
    onFilesChange: (files: ProjectFile[]) => void;
    readOnly?: boolean;
}

type TreeNode = {
    name: string;
    path: string;
    isFile: boolean;
    fileData?: ProjectFile;
    children: Record<string, TreeNode>;
};

function buildTree(files: ProjectFile[]): Record<string, TreeNode> {
    const root: Record<string, TreeNode> = {};
    for (const f of files) {
        const parts = f.path.split("/").filter(Boolean);
        let currentRecord = root;
        let buildingPath = "";
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isFile = i === parts.length - 1;
            buildingPath += (buildingPath ? "/" : "") + part;
            if (!currentRecord[part]) {
                currentRecord[part] = { name: part, path: buildingPath, isFile, fileData: isFile ? f : undefined, children: {} };
            }
            if (!isFile) currentRecord = currentRecord[part].children;
        }
    }
    return root;
}

const getIcon = (name: string) => {
    if (name.endsWith(".ts") || name.endsWith(".tsx") || name.endsWith(".js") || name.endsWith(".jsx"))
        return <FileCode size={13} className="text-yellow-400 shrink-0" />;
    if (name.endsWith(".json")) return <FileJson size={13} className="text-green-400 shrink-0" />;
    if (name.endsWith(".md")) return <FileText size={13} className="text-blue-400 shrink-0" />;
    return <FileText size={13} className="text-gray-400 shrink-0" />;
};

// ── Context Menu ─────────────────────────────────────────────────────────────
interface CtxMenu { x: number; y: number; node: TreeNode }

function ContextMenu({ menu, onClose, onNewFile, onNewFolder, onRename, onDelete }: {
    menu: CtxMenu;
    onClose: () => void;
    onNewFile: () => void;
    onNewFolder: () => void;
    onRename: () => void;
    onDelete: () => void;
}) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        window.addEventListener("mousedown", handler);
        return () => window.removeEventListener("mousedown", handler);
    }, [onClose]);

    const btn = "flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-300 hover:bg-[#27272a] hover:text-white transition-colors rounded text-left";

    return (
        <div
            ref={ref}
            style={{ top: menu.y, left: menu.x, position: "fixed", zIndex: 9999 }}
            className="bg-[#18181b] border border-[#3f3f46] rounded-lg shadow-xl p-1 min-w-[160px]"
        >
            {!menu.node.isFile && (
                <>
                    <button className={btn} onClick={onNewFile}><FilePlus size={13} className="text-cyan-400" /> New File</button>
                    <button className={btn} onClick={onNewFolder}><FolderPlus size={13} className="text-cyan-400" /> New Folder</button>
                    <div className="my-1 border-t border-[#27272a]" />
                </>
            )}
            <button className={btn} onClick={onRename}><Pencil size={13} className="text-gray-400" /> Rename</button>
            <div className="my-1 border-t border-[#27272a]" />
            <button className={`${btn} text-red-400 hover:text-red-300`} onClick={onDelete}><Trash2 size={13} /> Delete</button>
        </div>
    );
}

// ── Inline Input ─────────────────────────────────────────────────────────────
function InlineInput({ depth, defaultValue = "", placeholder, onConfirm, onCancel }: {
    depth: number; defaultValue?: string; placeholder: string;
    onConfirm: (value: string) => void; onCancel: () => void;
}) {
    const [val, setVal] = useState(defaultValue);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);

    const confirm = () => { const v = val.trim(); if (v) onConfirm(v); else onCancel(); };

    return (
        <div className="flex items-center px-2 py-0.5" style={{ paddingLeft: `calc(0.75rem + ${depth * 0.75}rem)` }}>
            <input
                ref={inputRef}
                value={val}
                onChange={e => setVal(e.target.value)}
                placeholder={placeholder}
                onKeyDown={e => { if (e.key === "Enter") confirm(); if (e.key === "Escape") onCancel(); }}
                onBlur={confirm}
                className="flex-1 bg-[#27272a] border border-cyan-500/60 text-white text-xs rounded px-2 py-1 outline-none font-mono"
            />
        </div>
    );
}

// ── Tree Node ────────────────────────────────────────────────────────────────
interface NodeActions {
    onCreate: (parentPath: string, name: string, isDir: boolean) => void;
    onRename: (oldPath: string, newName: string, isFile: boolean) => void;
    onDelete: (path: string, isFile: boolean) => void;
}

function FileTreeNode({
    node, depth, activeFile, onSelect, actions,
}: {
    node: TreeNode; depth: number; activeFile: ProjectFile | null;
    onSelect: (f: ProjectFile) => void; actions: NodeActions;
}) {
    const [isOpen, setIsOpen] = useState(depth < 2);
    const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
    const [inlineMode, setInlineMode] = useState<null | "newFile" | "newFolder" | "rename">(null);

    const handleCtxMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setCtxMenu({ x: e.clientX, y: e.clientY, node });
    };

    const isActive = activeFile?.id === node.fileData?.id;

    if (node.isFile) {
        return (
            <>
                {inlineMode === "rename" ? (
                    <InlineInput
                        depth={depth}
                        defaultValue={node.name}
                        placeholder="New name"
                        onConfirm={name => {
                            const parentDir = node.path.includes("/") ? node.path.substring(0, node.path.lastIndexOf("/")) : "";
                            const newPath = parentDir ? `${parentDir}/${name}` : name;
                            actions.onRename(node.path, newPath, true);
                            setInlineMode(null);
                        }}
                        onCancel={() => setInlineMode(null)}
                    />
                ) : (
                    <div
                        onContextMenu={handleCtxMenu}
                        onClick={() => onSelect(node.fileData!)}
                        className={`flex items-center gap-1.5 px-3 py-[3px] cursor-pointer select-none transition-colors border-l-2 group ${
                            isActive ? "bg-[#18181b] border-cyan-500 text-white" : "border-transparent hover:bg-[#18181b] text-gray-400 hover:text-white"
                        }`}
                        style={{ paddingLeft: `calc(0.75rem + ${depth * 0.75}rem)` }}
                    >
                        {getIcon(node.name)}
                        <span className="truncate text-[12px]">{node.name}</span>
                        <button
                            onClick={e => { e.stopPropagation(); actions.onDelete(node.path, true); }}
                            className="ml-auto p-0.5 opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all rounded shrink-0"
                            title="Delete file"
                        >
                            <Trash2 size={11} />
                        </button>
                    </div>
                )}
                {ctxMenu && (
                    <ContextMenu
                        menu={ctxMenu}
                        onClose={() => setCtxMenu(null)}
                        onNewFile={() => { setCtxMenu(null); }}
                        onNewFolder={() => { setCtxMenu(null); }}
                        onRename={() => { setCtxMenu(null); setInlineMode("rename"); }}
                        onDelete={() => { setCtxMenu(null); actions.onDelete(node.path, true); }}
                    />
                )}
            </>
        );
    }

    // Folder
    const sortedChildren = Object.values(node.children).sort((a, b) => {
        if (a.isFile === b.isFile) return a.name.localeCompare(b.name);
        return a.isFile ? 1 : -1;
    });

    return (
        <div className="flex flex-col">
            {inlineMode === "rename" ? (
                <InlineInput
                    depth={depth}
                    defaultValue={node.name}
                    placeholder="New folder name"
                    onConfirm={name => {
                        const parentDir = node.path.includes("/") ? node.path.substring(0, node.path.lastIndexOf("/")) : "";
                        const newPath = parentDir ? `${parentDir}/${name}` : name;
                        actions.onRename(node.path, newPath, false);
                        setInlineMode(null);
                    }}
                    onCancel={() => setInlineMode(null)}
                />
            ) : (
                <div
                    onContextMenu={handleCtxMenu}
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-1.5 py-[3px] cursor-pointer select-none transition-colors border-l-2 border-transparent hover:bg-[#18181b] text-gray-300 hover:text-white group"
                    style={{ paddingLeft: `calc(0.75rem + ${depth * 0.75}rem)` }}
                >
                    {isOpen ? <ChevronDown size={13} className="text-gray-500 shrink-0" /> : <ChevronRight size={13} className="text-gray-500 shrink-0" />}
                    {isOpen ? <FolderOpen size={13} className="text-cyan-400 shrink-0" /> : <Folder size={13} className="text-cyan-500 shrink-0" />}
                    <span className="truncate text-[12px]">{node.name}</span>
                    <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                        <button
                            onClick={e => { e.stopPropagation(); setIsOpen(true); setInlineMode("newFile"); }}
                            className="p-0.5 hover:text-cyan-400 text-gray-500 rounded transition-colors" title="New file"
                        ><FilePlus size={11} /></button>
                        <button
                            onClick={e => { e.stopPropagation(); setIsOpen(true); setInlineMode("newFolder"); }}
                            className="p-0.5 hover:text-cyan-400 text-gray-500 rounded transition-colors" title="New folder"
                        ><FolderPlus size={11} /></button>
                        <button
                            onClick={e => { e.stopPropagation(); actions.onDelete(node.path, false); }}
                            className="p-0.5 hover:text-red-400 text-gray-500 rounded transition-colors" title="Delete folder"
                        ><Trash2 size={11} /></button>
                    </div>
                </div>
            )}

            {isOpen && (
                <div className="flex flex-col">
                    {inlineMode === "newFile" && (
                        <InlineInput
                            depth={depth + 1}
                            placeholder="filename.ts"
                            onConfirm={name => {
                                actions.onCreate(node.path, name, false);
                                setInlineMode(null);
                            }}
                            onCancel={() => setInlineMode(null)}
                        />
                    )}
                    {inlineMode === "newFolder" && (
                        <InlineInput
                            depth={depth + 1}
                            placeholder="folder-name"
                            onConfirm={name => {
                                actions.onCreate(node.path, name, true);
                                setInlineMode(null);
                            }}
                            onCancel={() => setInlineMode(null)}
                        />
                    )}
                    {sortedChildren.map(n => (
                        <FileTreeNode key={n.path} node={n} depth={depth + 1} activeFile={activeFile} onSelect={onSelect} actions={actions} />
                    ))}
                </div>
            )}

            {ctxMenu && (
                <ContextMenu
                    menu={ctxMenu}
                    onClose={() => setCtxMenu(null)}
                    onNewFile={() => { setCtxMenu(null); setIsOpen(true); setInlineMode("newFile"); }}
                    onNewFolder={() => { setCtxMenu(null); setIsOpen(true); setInlineMode("newFolder"); }}
                    onRename={() => { setCtxMenu(null); setInlineMode("rename"); }}
                    onDelete={() => { setCtxMenu(null); actions.onDelete(node.path, false); }}
                />
            )}
        </div>
    );
}

// ── Root Explorer ────────────────────────────────────────────────────────────
export default function FileExplorer({ files, activeFile, onSelect, projectId, token, onFilesChange, readOnly }: FileExplorerProps) {
    const [rootInline, setRootInline] = useState<null | "newFile" | "newFolder">(null);
    const treeRoot = useMemo(() => buildTree(files || []), [files]);

    const apiBase = `http://localhost:3000/api/projects/${projectId}`;
    const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` };

    const doCreate = useCallback(async (parentPath: string, name: string, isDir: boolean) => {
        const newPath = parentPath ? `${parentPath}/${name}` : name;
        if (isDir) {
            // Directories are virtual — create a .gitkeep placeholder
            const keepPath = `${newPath}/.gitkeep`;
            await fetch(`${apiBase}/files/create`, {
                method: "POST", headers: authHeaders,
                body: JSON.stringify({ path: keepPath, content: "" }),
            });
            onFilesChange([...files, { id: crypto.randomUUID(), path: keepPath, content: "" }]);
        } else {
            const res = await fetch(`${apiBase}/files/create`, {
                method: "POST", headers: authHeaders,
                body: JSON.stringify({ path: newPath, content: "" }),
            });
            const data = await res.json();
            if (data.success) {
                const newFile: ProjectFile = { id: crypto.randomUUID(), path: newPath, content: "" };
                onFilesChange([...files, newFile]);
                onSelect(newFile);
            }
        }
    }, [files, projectId, token, onFilesChange, onSelect]);

    const doDelete = useCallback(async (path: string, _isFile: boolean) => {
        if (!window.confirm(`Delete "${path}"?`)) return;
        await fetch(`${apiBase}/files`, {
            method: "DELETE", headers: authHeaders,
            body: JSON.stringify({ path }),
        });
        onFilesChange(files.filter(f => f.path !== path && !f.path.startsWith(path + "/")));
    }, [files, projectId, token, onFilesChange]);

    const doRename = useCallback(async (oldPath: string, newPath: string, _isFile: boolean) => {
        await fetch(`${apiBase}/files/rename`, {
            method: "PATCH", headers: authHeaders,
            body: JSON.stringify({ oldPath, newPath }),
        });
        onFilesChange(files.map(f => {
            if (f.path === oldPath) return { ...f, path: newPath };
            if (f.path.startsWith(oldPath + "/")) return { ...f, path: newPath + f.path.slice(oldPath.length) };
            return f;
        }));
    }, [files, projectId, token, onFilesChange]);

    const actions: NodeActions = { onCreate: doCreate, onRename: doRename, onDelete: doDelete };

    const sortedRoot = Object.values(treeRoot).sort((a, b) => {
        if (a.isFile === b.isFile) return a.name.localeCompare(b.name);
        return a.isFile ? 1 : -1;
    });

    return (
        <div className="flex flex-col h-full bg-[#09090b] text-[#c9d1d9] text-[13px] font-mono leading-relaxed select-none">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#27272a] shrink-0 font-sans">
                <h2 className="font-semibold text-[10px] tracking-wider uppercase text-gray-500">Explorer</h2>
                {!readOnly && (
                    <div className="flex items-center gap-0.5">
                        <button
                            onClick={() => setRootInline("newFile")}
                            className="p-1 hover:bg-[#27272a] rounded transition-colors text-gray-500 hover:text-white"
                            title="New File"
                        ><FilePlus size={13} /></button>
                        <button
                            onClick={() => setRootInline("newFolder")}
                            className="p-1 hover:bg-[#27272a] rounded transition-colors text-gray-500 hover:text-white"
                            title="New Folder"
                        ><FolderPlus size={13} /></button>
                    </div>
                )}
            </div>

            {/* Tree */}
            <div className="flex-1 overflow-y-auto py-1 scrollbar-thin scrollbar-thumb-[#27272a] scrollbar-track-transparent">
                {(!files || files.length === 0) && !rootInline && (
                    <div className="px-4 py-3 text-[11px] text-gray-600 italic font-sans">
                        No files. Use <strong className="text-gray-400">+</strong> to create one.
                    </div>
                )}

                {rootInline === "newFile" && (
                    <InlineInput
                        depth={0}
                        placeholder="filename.ts"
                        onConfirm={name => { doCreate("", name, false); setRootInline(null); }}
                        onCancel={() => setRootInline(null)}
                    />
                )}
                {rootInline === "newFolder" && (
                    <InlineInput
                        depth={0}
                        placeholder="folder-name"
                        onConfirm={name => { doCreate("", name, true); setRootInline(null); }}
                        onCancel={() => setRootInline(null)}
                    />
                )}

                {sortedRoot.map(node => (
                    <FileTreeNode
                        key={node.path}
                        node={node}
                        depth={0}
                        activeFile={activeFile}
                        onSelect={onSelect}
                        actions={actions}
                    />
                ))}
            </div>
        </div>
    );
}
