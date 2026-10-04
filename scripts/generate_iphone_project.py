"""Generate a tiny dependency-free Xcode app project from frozen source/resource paths."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; out=ROOT/'ios/OfflineTravelDemo.xcodeproj';out.mkdir(exist_ok=True)
ids={}; counter=0
def uid(name):
 global counter
 if name not in ids: counter+=1;ids[name]=f'{counter:024X}'
 return ids[name]
objects=[]
def obj(name,body): objects.append(f'{uid(name)} = {{ {body} }};');return uid(name)
sources=['OfflineTravelDemo/OfflineTravelApp.swift','OfflineTravelDemo/TravelModel.swift','OfflineTravelDemo/ModelInference.swift','../fixtures/iphone/OfflineBundle.swift']
resources=['../fixtures/iphone/offline_travel_bundle_v1.json','../fixtures/iphone/OfflineTravelBundleFCO.json','../fixtures/iphone/apollo_context_packet_v2.txt','../fixtures/iphone/apollo_catalog_v2.json','../fixtures/iphone/wallet_state_v1.json']
refs=[];sb=[];rb=[]
for path in sources+resources:
 ref=obj('file:'+path,f'isa = PBXFileReference; path = "{path}"; sourceTree = "<group>";');refs.append(ref)
 build=obj('build:'+path,f'isa = PBXBuildFile; fileRef = {ref};');(sb if path in sources else rb).append(build)
product=obj('product','isa = PBXFileReference; explicitFileType = wrapper.application; path = OfflineTravelDemo.app; sourceTree = BUILT_PRODUCTS_DIR;')
products=obj('products',f'isa = PBXGroup; children = ({product},); name = Products; sourceTree = "<group>";')
group=obj('group',f'isa = PBXGroup; children = ({",".join(refs+[products])},); sourceTree = "<group>";')
sp=obj('sources',f'isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = ({",".join(sb)},); runOnlyForDeploymentPostprocessing = 0;')
rp=obj('resources',f'isa = PBXResourcesBuildPhase; buildActionMask = 2147483647; files = ({",".join(rb)},); runOnlyForDeploymentPostprocessing = 0;')
fp=obj('frameworks','isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0;')
settings='PRODUCT_BUNDLE_IDENTIFIER = works.biobit.baymax.offlinetravel.demo; PRODUCT_NAME = "$(TARGET_NAME)"; SWIFT_VERSION = 5.0; IPHONEOS_DEPLOYMENT_TARGET = 17.0; SDKROOT = iphoneos; SUPPORTED_PLATFORMS = "iphoneos iphonesimulator"; TARGETED_DEVICE_FAMILY = 1; GENERATE_INFOPLIST_FILE = YES; INFOPLIST_KEY_UILaunchScreen_Generation = YES; INFOPLIST_KEY_UIApplicationSceneManifest_Generation = YES; CODE_SIGN_STYLE = Automatic; DEVELOPMENT_TEAM = ""; CURRENT_PROJECT_VERSION = 1; MARKETING_VERSION = 1.0;'
tcs=[]
for n in ['Debug','Release']:
 opt='-Onone' if n=='Debug' else '-O'
 tcs.append(obj('target:'+n,f'isa = XCBuildConfiguration; name = {n}; buildSettings = {{ {settings} SWIFT_OPTIMIZATION_LEVEL = "{opt}"; }};'))
pcs=[obj('project:'+n,f'isa = XCBuildConfiguration; name = {n}; buildSettings = {{ CLANG_ENABLE_MODULES = YES; }};') for n in ['Debug','Release']]
tcl=obj('targetconfigs',f'isa = XCConfigurationList; buildConfigurations = ({",".join(tcs)},); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;')
pcl=obj('projectconfigs',f'isa = XCConfigurationList; buildConfigurations = ({",".join(pcs)},); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;')
target=obj('target',f'isa = PBXNativeTarget; buildConfigurationList = {tcl}; buildPhases = ({sp},{fp},{rp},); buildRules = (); dependencies = (); name = OfflineTravelDemo; productName = OfflineTravelDemo; productReference = {product}; productType = "com.apple.product-type.application";')
project=obj('project',f'isa = PBXProject; attributes = {{ LastUpgradeCheck = 2610; }}; buildConfigurationList = {pcl}; compatibilityVersion = "Xcode 14.0"; developmentRegion = en; knownRegions = (en,Base,); mainGroup = {group}; productRefGroup = {products}; projectDirPath = ""; projectRoot = ""; targets = ({target},);')
(out/'project.pbxproj').write_text('// !$*UTF8*$!\n{ archiveVersion = 1; classes = {}; objectVersion = 56; objects = {\n'+'\n'.join(objects)+'\n}; rootObject = '+project+'; }\n')
print(out)
