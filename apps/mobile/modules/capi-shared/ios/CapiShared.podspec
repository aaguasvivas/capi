Pod::Spec.new do |s|
  s.name           = 'CapiShared'
  s.version        = '1.0.0'
  s.summary        = 'Writes the file the Capi iMessage extension reads'
  s.description    = 'Writes capi-shared.json into the App Group container shared with the CapiMessages extension'
  s.author         = ''
  s.homepage       = 'https://playcapi.com'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,swift}"
end
