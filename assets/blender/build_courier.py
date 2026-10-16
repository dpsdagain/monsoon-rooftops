"""Create the original Stormline courier in Blender and export its articulated GLB.

Run: blender --background --factory-startup --python build_courier.py -- --output DIR
The model uses named object pivots; the game drives these joints directly.
No external assets, add-ons, downloaded models or textures are required.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

args = argparse.ArgumentParser()
args.add_argument('--output', required=True)
options = args.parse_args(sys.argv[sys.argv.index('--') + 1:])
out = Path(options.output).resolve()
out.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
asset_scene = bpy.context.scene
asset_scene.name = 'Courier_Asset'
asset_objects = []


def xyz(p):
    """Game X/right, Y/up, Z/forward to Blender X/right, Y/back, Z/up."""
    return (p[0], -p[2], p[1])


def srgb(v):
    return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4


def mat(name, hex_color, roughness=.8, metalness=0, emission=0):
    rgb = tuple(srgb(int(hex_color[i:i+2], 16) / 255) for i in (0, 2, 4))
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*rgb, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metalness
    if emission:
        bsdf.inputs['Emission Color'].default_value = (*rgb, 1)
        bsdf.inputs['Emission Strength'].default_value = emission
    return m


coat = mat('Raincoat / warm canvas', 'DACA9C', .87)
trim = mat('Raincoat / reinforced seams', 'A9986D', .85)
lining = mat('Hood lining / midnight teal', '183038', .9)
pants = mat('Trousers / charcoal blue', '263C42', .84)
rubber = mat('Boots and gloves / rubber', '12272E', .68)
sole = mat('Boot sole / worn olive', '757962', .8)
orange = mat('Scarf and delivery flap / burnt orange', 'C56738', .87)
orange_light = mat('Scarf edge / terracotta', 'DD8A52', .88)
bag = mat('Bag / weatherproof teal', '355A5A', .69)
reflector = mat('Safety tape / pale lime', 'D8E9AD', .55, .1, .12)
goggles = mat('Goggles / green smoked lens', '608781', .22, .5)
metal = mat('Buckles / gunmetal', '425558', .43, .65)


def joint(name, parent=None, location=(0, 0, 0)):
    obj = bpy.data.objects.new(name, None)
    asset_scene.collection.objects.link(obj)
    obj.empty_display_type = 'PLAIN_AXES'
    obj.empty_display_size = .1
    obj.parent = parent
    obj.location = xyz(location)
    asset_objects.append(obj)
    return obj


def attach(obj, name, parent, location, material, smooth=False):
    obj.name = name
    obj.parent = parent
    obj.location = xyz(location)
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = smooth
    asset_objects.append(obj)
    return obj


def box(name, parent, location, size, material, bevel=.02):
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj = attach(bpy.context.object, name, parent, location, material)
    obj.scale = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new('Soft manufactured edges', 'BEVEL')
        mod.width = min(bevel, min(size) * .25)
        mod.segments = 1
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def ball(name, parent, location, size, material, segments=16, rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=1)
    obj = attach(bpy.context.object, name, parent, location, material, True)
    obj.scale = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return obj


def mesh(name, parent, vertices, faces, material, smooth=False):
    data = bpy.data.meshes.new(name)
    data.from_pydata([xyz(v) for v in vertices], [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    asset_scene.collection.objects.link(obj)
    return attach(obj, name, parent, (0, 0, 0), material, smooth)


def loft(name, parent, rings, material, count=12, center=(0, 0, 0), smooth=True):
    # Each ring specifies vertical offset and elliptical half widths.
    rings = sorted(rings, key=lambda ring: ring[0])
    vertices = []
    for y, rx, rz in rings:
        for i in range(count):
            a = 2 * math.pi * i / count
            vertices.append((center[0] + math.sin(a)*rx, center[1] + y, center[2] + math.cos(a)*rz))
    faces = [tuple(reversed(range(count))), tuple((len(rings)-1)*count+i for i in range(count))]
    for row in range(len(rings)-1):
        for i in range(count):
            a = row*count+i
            b = row*count+(i+1)%count
            faces.append((a,b,b+count,a+count))
    return mesh(name,parent,vertices,faces,material,smooth)


root = joint('RigBody')
root['asset'] = 'STORMLINE / courier 01'
root['rig_type'] = 'Articulated object pivots; runtime joint animation'
root['forward_axis'] = 'glTF +Z; vertical +Y; pivot at feet'
loft('Raincoat / shaped upper shell',root,[(1.13,.395,.265),(1.38,.365,.25),(1.62,.40,.245),(1.72,.445,.22),(1.83,.205,.16)],coat)
skirt = joint('CoatHem',root,(0,1.02,0))
loft('Coat / flared hem',skirt,[(-.16,.46,.31),(.02,.44,.285),(.18,.39,.265)],coat)
box('Coat / lower seam',skirt,(0,-.125,.3),(.73,.035,.023),trim,.005)
box('Coat / storm flap',root,(0,1.47,.264),(.085,.67,.035),trim,.008)
box('Coat / zipper',root,(0,1.46,.288),(.021,.63,.012),metal,.002)
box('Coat / zip pull',root,(.025,1.7,.307),(.027,.065,.022),orange,.004)
for side in [-1,1]:
    box('Coat / angled pocket',root,(side*.225,1.3,.247),(.225,.16,.04),trim,.015).rotation_euler[1]=side*.1
    box('Coat / pocket flap',root,(side*.225,1.37,.273),(.24,.05,.025),coat,.008)
    box('Coat / reflector',root,(side*.22,1.59,.263),(.24,.045,.018),reflector,.004)
    box('Coat / side vent',skirt,(side*.39,-.05,-.02),(.028,.2,.23),trim,.006)

head = joint('Head',root,(0,2.03,0))
# Hollow hood with an actual front opening, rather than a solid sphere.
vertices=[]
latitudes,segments=12,20
for row in range(latitudes+1):
    phi=math.pi*row/latitudes
    for i in range(segments):
        theta=2*math.pi*i/segments
        vertices.append((.345*math.sin(phi)*math.sin(theta),.39*math.cos(phi),.32*math.sin(phi)*math.cos(theta)-.035))
faces=[]
for row in range(latitudes):
    for i in range(segments):
        theta=2*math.pi*(i+.5)/segments
        front=math.cos(theta)>.6 and 4<=row<=8
        if not front:
            a=row*segments+i;b=row*segments+(i+1)%segments
            faces.append((a,a+segments,b+segments,b))
hood=mesh('Hood / open weather shell',head,vertices,faces,coat,True)
mod=hood.modifiers.new('Hood fabric thickness','SOLIDIFY');mod.thickness=.018
bpy.context.view_layer.objects.active=hood;bpy.ops.object.modifier_apply(modifier=mod.name)
ball('Hood / dark inner lining',head,(0,-.04,.09),(.27,.295,.19),lining)
ball('Face / storm mask',head,(0,-.115,.215),(.21,.16,.085),pants,12,8)
box('Face / goggle frame',head,(0,.05,.263),(.40,.135,.085),rubber,.025)
box('Face / smoked lens',head,(0,.052,.309),(.345,.082,.018),goggles,.009)
box('Face / nose bridge',head,(0,.045,.324),(.023,.09,.015),metal,.003)
box('Hood / rain brim',head,(0,.205,.225),(.55,.065,.27),coat,.025)
for side in [-1,1]:
    box('Hood / draw cord',head,(side*.19,-.235,.245),(.014,.17,.014),trim,.003)
    ball('Hood / cord stop',head,(side*.19,-.31,.25),(.025,.034,.025),rubber,8,6)

# A chunky waterproof delivery bag, readable from the follow camera.
box('Bag / main padded shell',root,(0,1.43,-.365),(.65,.76,.35),bag,.07)
box('Bag / orange rain flap',root,(0,1.64,-.57),(.69,.32,.105),orange,.04)
box('Bag / lower panel',root,(0,1.22,-.558),(.54,.24,.07),lining,.025)
box('Bag / safety stripe',root,(0,1.39,-.6),(.5,.048,.02),reflector,.005)
for side in [-1,1]:
    box('Bag / shoulder strap',root,(side*.24,1.49,.19),(.07,.56,.045),lining,.012)
    box('Bag / back webbing',root,(side*.22,1.4,-.62),(.045,.55,.035),rubber,.006)
    box('Bag / clasp',root,(side*.22,1.48,-.65),(.085,.095,.035),metal,.01)
    box('Bag / side pocket',root,(side*.365,1.27,-.37),(.115,.29,.23),bag,.025)
box('Bag / top handle',root,(0,1.86,-.35),(.27,.055,.10),rubber,.015)
# Three physical dashes form a compact delivery mark, no baked labels.
for i in range(3):
    box('Bag / delivery mark',root,(-.07+i*.07,1.68,-.63),(.04,.105,.018),reflector,.003).rotation_euler[1]=-.3

for side,suffix in [(-1,'L'),(1,'R')]:
    hip=joint('Hip_'+suffix,root,(side*.205,.91,0))
    loft('Trouser / thigh '+suffix,hip,[(.015,.165,.145),(-.20,.15,.14),(-.43,.125,.12)],pants,10)
    box('Trouser / side seam '+suffix,hip,(side*.145,-.20,0),(.023,.31,.08),lining,.004)
    knee=joint('Knee_'+suffix,hip,(0,-.43,0))
    loft('Trouser / calf '+suffix,knee,[(0,.125,.12),(-.19,.11,.105),(-.32,.095,.1)],pants,10)
    box('Trouser / knee reinforcement '+suffix,knee,(0,-.035,.112),(.20,.19,.06),lining,.025)
    foot=joint('Foot_'+suffix,knee,(0,-.35,.065))
    box('Boot / sole '+suffix,foot,(0,-.075,.06),(.28,.105,.44),sole,.024)
    box('Boot / upper '+suffix,foot,(0,.01,.03),(.245,.16,.365),rubber,.035)
    loft('Boot / ankle '+suffix,foot,[(.02,.12,.12),(.18,.10,.10)],rubber,10,center=(0,0,-.04))
    for k in range(3):box('Boot / lace '+suffix,foot,(0,.095,.1+k*.045),(.18,.018,.022),trim,.004)
    box('Boot / heel tab '+suffix,foot,(0,.15,-.145),(.065,.1,.022),orange,.005)
    shoulder=joint('Shoulder_'+suffix,root,(side*.435,1.67,0))
    loft('Coat / upper sleeve '+suffix,shoulder,[(.04,.15,.15),(-.17,.165,.145),(-.43,.12,.115)],coat)
    box('Coat / shoulder panel '+suffix,shoulder,(side*.135,-.12,-.015),(.034,.21,.20),trim,.012)
    elbow=joint('Elbow_'+suffix,shoulder,(0,-.42,0))
    loft('Coat / forearm '+suffix,elbow,[(.015,.125,.12),(-.18,.12,.11),(-.33,.095,.09)],coat)
    loft('Coat / cuff '+suffix,elbow,[(-.27,.11,.105),(-.34,.105,.1)],lining,10)
    box('Sleeve / safety band '+suffix,elbow,(0,-.22,.108),(.19,.055,.016),reflector,.004)
    grip=joint('HandGrip_'+suffix,elbow,(0,-.405,.015))
    ball('Glove / palm '+suffix,grip,(0,0,0),(.105,.135,.09),rubber,12,8)
    ball('Glove / thumb '+suffix,grip,(-side*.087,.015,.025),(.055,.065,.05),rubber,8,6)
    box('Glove / knuckle '+suffix,grip,(0,.025,-.075),(.145,.10,.035),lining,.014)

scarf_base=joint('ScarfCollar',root,(-.08,1.845,-.1))
loft('Scarf / neck wrap',scarf_base,[(-.065,.27,.23),(.07,.25,.22)],orange,16,center=(.08,0,.1))
previous=scarf_base
for i in range(5):
    scarf=joint('Scarf_'+str(i),previous,(0,0,-.13 if i==0 else -.29))
    width=.25-i*.025
    verts=[(-width/2,.005,0),(width/2,-.008,0),(-width/2,.01,-.16),(width/2,.025,-.16),(-width*.42,-.01,-.32),(width*.4,0,-.31)]
    if i==4:verts[4]=(-width*.5,-.01,-.40)
    cloth=mesh('Scarf / cloth panel '+str(i),scarf,verts,[(0,1,3,2),(2,3,5,4)],orange)
    mod=cloth.modifiers.new('Cloth thickness','SOLIDIFY');mod.thickness=.009
    bpy.context.view_layer.objects.active=cloth;bpy.ops.object.modifier_apply(modifier=mod.name)
    mesh('Scarf / woven edge '+str(i),scarf,[(width/2-.02,-.01,0),(width/2,-.01,0),(width*.4,0,-.31),(width*.4-.02,0,-.31)],[(0,1,2,3)],orange_light)
    previous=scarf

# Join rigid pieces attached to the same joint. Material slots preserve accents.
for pivot in [obj for obj in asset_objects if obj.type=='EMPTY']:
    pieces=[obj for obj in asset_scene.objects if obj.type=='MESH' and obj.parent==pivot]
    if len(pieces)>1:
        bpy.ops.object.select_all(action='DESELECT')
        for obj in pieces:obj.select_set(True)
        bpy.context.view_layer.objects.active=pieces[0]
        bpy.ops.object.join()
        pieces[0].name=pivot.name+'_Geometry'
asset_objects=[obj for obj in asset_scene.objects]
for obj in asset_objects:obj.select_set(True)
bpy.context.view_layer.objects.active=root
export_args=dict(filepath=str(out/'courier.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=False,export_apply=True,export_extras=True,export_cameras=False,export_lights=False,export_texcoords=False,export_normals=True)
supported=bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
bpy.ops.export_scene.gltf(**{key:value for key,value in export_args.items() if key in supported})
triangles=0
for obj in asset_objects:
    if obj.type=='MESH':obj.data.calc_loop_triangles();triangles+=len(obj.data.loop_triangles)
stats={'blender':bpy.app.version_string,'triangles':triangles,'mesh_objects':sum(obj.type=='MESH' for obj in asset_objects),'joints':sum(obj.type=='EMPTY' for obj in asset_objects),'bytes':(out/'courier.glb').stat().st_size,'rig':'named rigid object pivots; animated in the game','textures':0}
(out/'courier-stats.json').write_text(json.dumps(stats,indent=2)+'\n',encoding='utf-8')

# A separate studio scene provides a front/back inspection render.
studio=bpy.data.scenes.new('Courier_Studio')
bpy.context.window.scene=studio
for index,x in enumerate([-1.0,1.0]):
    copies={}
    for source in asset_objects:
        obj=source.copy();obj.data=source.data
        studio.collection.objects.link(obj);copies[source]=obj
    for source,obj in copies.items():
        obj.parent=copies.get(source.parent)
    display_root=copies[root]
    display_root.location.x=x
    display_root.rotation_euler.z=math.radians(-18 if index==0 else 160)
    for source,obj in copies.items():
        if source.name.startswith('Scarf_') and source.type=='EMPTY':
            scarf_index=int(source.name.split('_')[1])
            obj.rotation_euler.x=.045*math.sin(scarf_index*1.5+index*.4)
floor_mat=mat('Studio / muted teal','223D43',.9)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.02))
floor=bpy.context.object;floor.name='Studio floor';floor.data.materials.append(floor_mat)
def area(name,location,energy,size,color):
    data=bpy.data.lights.new(name,'AREA');data.energy=energy;data.shape='DISK';data.size=size;data.color=color
    light=bpy.data.objects.new(name,data);studio.collection.objects.link(light);light.location=location
    light.rotation_euler=(Vector((0,0,1.2))-light.location).to_track_quat('-Z','Y').to_euler()
area('Warm key',(-3,-4,6),550,4,(1,.87,.69))
area('Soft fill',(4,-1,3),330,3,(.65,.83,1))
area('Rain rim',(1,4,5),650,3,(.8,1,.92))
camera_data=bpy.data.cameras.new('Inspection camera');camera=bpy.data.objects.new('Inspection camera',camera_data);studio.collection.objects.link(camera)
camera.location=(3.8,-8,3.4);camera.rotation_euler=(Vector((0,0,1.15))-camera.location).to_track_quat('-Z','Y').to_euler();camera_data.type='ORTHO';camera_data.ortho_scale=5.3;studio.camera=camera
studio.world=bpy.data.worlds.new('Studio atmosphere');studio.world.use_nodes=True;studio.world.node_tree.nodes['Background'].inputs[0].default_value=(.08,.13,.15,1);studio.world.node_tree.nodes['Background'].inputs[1].default_value=.5
studio.render.engine='CYCLES';studio.cycles.samples=24;studio.cycles.use_denoising=True
studio.render.resolution_x=1200;studio.render.resolution_y=850;studio.render.resolution_percentage=100
studio.render.image_settings.file_format='PNG';studio.render.filepath=str(out/'courier-preview.png')
studio.view_settings.view_transform='AgX'
bpy.context.window.scene=asset_scene
asset_scene['README']='Original Stormline courier. Neutral asset in this scene; front/back render in Courier_Studio. Named pivots are driven by stormline-model.js. +Z forward in exported GLB.'
bpy.ops.wm.save_as_mainfile(filepath=str(out/'courier.blend'))
bpy.ops.render.render(write_still=True,scene=studio.name)
print('STORMLINE_COURIER_COMPLETE '+json.dumps(stats))
