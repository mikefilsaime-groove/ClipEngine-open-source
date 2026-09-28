"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createProject } from "@/actions/project-actions";
import { Plus } from "lucide-react";

export function CreateProjectDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [sourceVideoPath, setSourceVideoPath] = useState("");
  const [outputFolder, setOutputFolder] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const project = await createProject({ name, sourceVideoPath, outputFolder });
      setOpen(false);
      setName("");
      setSourceVideoPath("");
      setOutputFolder("");
      router.push(`/project/${project.id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> New Project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Project Name</Label>
            <Input
              id="name"
              placeholder="WSP Episode 47"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="source">Source Video Path</Label>
            <Input
              id="source"
              placeholder="~/Podcasts/episode-47.mp4"
              value={sourceVideoPath}
              onChange={(e) => setSourceVideoPath(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="output">Output Folder</Label>
            <Input
              id="output"
              placeholder="~/Podcasts/episode-47-output"
              value={outputFolder}
              onChange={(e) => setOutputFolder(e.target.value)}
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
