import { emit } from "@/lib/emit";
import { labels as mainModes } from "@/modes";
import { labels as fillWayModes } from "@/fillWays";

let names = ["isMagneticNode", "floodfill"];
names = names.concat(mainModes, fillWayModes);
names.forEach((name) => emit.register(name));
