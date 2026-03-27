import { FileCode, FileJson, FileText, Folder, Plus, Trash2, ChevronRight, ChevronDown } from "lucide-react";
import ImportModal from "./ImportModal";
import type { ProjectFile } from "./Workspace";
import { useState, useMemo } from "react";

interface FileExplorerProps {
    files: ProjectFile[];
    activeFile: ProjectFile | null;
    onSelect: (file: ProjectFile) => void;
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
        // Asigură-te că ignorăm slash-urile goale
        const parts = f.path.split("/").filter(Boolean);
        let currentRecord = root;
        
        let buildingPath = "";
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isFile = i === parts.length - 1;
            buildingPath += (buildingPath ? "/" : "") + part;
            
            if (!currentRecord[part]) {
                currentRecord[part] = {
                    name: part,
                    path: buildingPath,
                    isFile: isFile,
                    fileData: isFile ? f : undefined,
                    children: {}
                };
            }
            if (!isFile) {
                currentRecord = currentRecord[part].children;
            }
        }
    }
    return root;
}

const getIcon = (path: string) => {
    if (path.endsWith(".ts") || path.endsWith(".tsx") || path.endsWith(".js")) return <FileCode size={14} className="text-yellow-400" />;
    if (path.endsWith(".json")) return <FileJson size={14} className="text-green-400" />;
    if (path.endsWith(".md")) return <FileText size={14} className="text-blue-400" />;
    return <FileText size={14} className="text-gray-400" />;
};

function FileTreeNodeComponent({ node, depth, activeFile, onSelect }: { node: TreeNode, depth: number, activeFile: ProjectFile | null, onSelect: (f: ProjectFile) => void }) {
    // Folderele din root level să fie deschise automat prima oară
    const [isOpen, setIsOpen] = useState(depth < 2);
    
    if (node.isFile) {
        const isActive = activeFile?.id === node.fileData?.id;
        return (
            <div 
                onClick={() => onSelect(node.fileData!)}
                className={`flex items-center gap-1.5 px-3 py-1 cursor-pointer select-none transition-colors border-l-2 ${
                    isActive
                        ? "bg-[#18181b] border-cyan-500 text-white"
                        : "border-transparent hover:bg-[#18181b] text-gray-400 hover:text-white"
                }`}
                style={{ paddingLeft: `calc(1rem + ${depth * 0.75}rem)` }}
            >
                {getIcon(node.name)}
                <span className="truncate">{node.name}</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col">
            <div 
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 px-3 py-1 cursor-pointer select-none transition-colors border-l-2 border-transparent hover:bg-[#18181b] text-gray-300 hover:text-white"
                style={{ paddingLeft: `calc(1rem + ${depth * 0.75}rem)` }}
            >
                {isOpen ? <ChevronDown size={14} className="text-gray-500" /> : <ChevronRight size={14} className="text-gray-500" />}
                <Folder size={14} className="text-cyan-500" />
                <span className="truncate">{node.name}</span>
            </div>
            {isOpen && (
                <div className="flex flex-col">
                    {/* Sortăm Node-urile: Folderele primele, alfabetic, apoi fișierele alfabetic */}
                    {Object.values(node.children)
                        .sort((a,b) => {
                            if (a.isFile === b.isFile) return a.name.localeCompare(b.name);
                            return a.isFile ? 1 : -1;
                        })
                        .map(n => (
                            <FileTreeNodeComponent key={n.path} node={n} depth={depth + 1} activeFile={activeFile} onSelect={onSelect} />
                        ))
                    }
                </div>
            )}
        </div>
    );
}

export default function FileExplorer({ files, activeFile, onSelect, readOnly }: FileExplorerProps) {
	const [isImportModalOpen, setImportModalOpen] = useState(false);

    // Recompunem Tree-ul doar când se modifică sursa files array-ul 
    const treeRoot = useMemo(() => buildTree(files || []), [files]);

	return (
		<div className="flex flex-col h-full bg-[#09090b] text-[#c9d1d9] text-[13px] font-mono leading-relaxed">
			<div className="flex items-center justify-between p-3 border-b border-[#27272a] shrink-0 font-sans">
				<h2 className="font-semibold text-xs tracking-wider uppercase text-gray-400">Explorer</h2>
				{!readOnly && (
                    <div className="flex gap-2">
					    <button 
                            onClick={() => setImportModalOpen(true)}
                            className="p-1 hover:bg-[#18181b] rounded transition-colors text-gray-400 hover:text-white"
                            title="Import from GitHub"
                        >
						    <Plus size={14} />
					    </button>
                        <button className="p-1 hover:bg-[#18181b] rounded transition-colors text-gray-400 hover:text-red-400">
						    <Trash2 size={14} />
					    </button>
				    </div>
                )}
			</div>
			
			<div className="flex-1 overflow-y-auto py-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                {(!files || files.length === 0) && (
                    <div className="px-4 py-3 text-xs text-gray-500 italic font-sans">No files loaded. Use the top menu to import a repository.</div>
                )}
				
                {Object.values(treeRoot)
                    .sort((a,b) => {
                        if (a.isFile === b.isFile) return a.name.localeCompare(b.name);
                        return a.isFile ? 1 : -1;
                    })
                    .map(node => (
                        <FileTreeNodeComponent key={node.path} node={node} depth={0} activeFile={activeFile} onSelect={onSelect} />
                    ))
                }
			</div>

            <ImportModal 
                isOpen={isImportModalOpen} 
                onClose={() => setImportModalOpen(false)} 
                onSuccess={(projectId, _path) => console.log("Import loaded!", projectId)} 
            />
		</div>
	);
}
