<TouchableOpacity
					activeOpacity={isOwner ? 0.8 : 1}
					onPress={() => {
					  if (isOwner) {
						setCoverOptionVisible(true);
					  } else {
						setPreviewType("cover");
						setPreviewVisible(true);
					  }
					}}
					className="h-44 w-full relative"
				  >
					<Image
					  source={{ uri: coverUrl }}
					  className="w-full h-full object-cover"
					/>
			
					{/* Camera Icon (Owner Only) */}
					{isOwner && (
					  <View className="absolute bottom-3 right-3 bg-black/60 p-2 rounded-full">
						<Ionicons name="camera" size={18} color="white" />
					  </View>
					)}
			
					{/* Nav Buttons Overlay */}
					<SafeAreaView className="absolute top-0 w-full flex-row justify-between px-4 pt-2">
					  <TouchableOpacity
						onPress={() => router.back()}
						className="w-10 h-10 rounded-full bg-black/40 items-center justify-center"
					  >
						<Ionicons name="arrow-back" size={24} color="white" />
					  </TouchableOpacity>
					  <TouchableOpacity className="w-10 h-10 rounded-full bg-black/40 items-center justify-center">
						<Ionicons name="ellipsis-vertical" size={24} color="white" />
					  </TouchableOpacity>
					</SafeAreaView>
				  </TouchableOpacity>

			<View className="px-4">
			 {/* Profile Info */}
					<View className="px-5 -mt-16 mb-2">
					  
				   
					  <View className="flex-row justify-between items-end">
						
						{/* PROFILE IMAGE */}
						<TouchableOpacity
						  onPress={() => {
							if (isOwner) {
							  setProfileOptionVisible(true);
							} else {
							  setPreviewType("profile");
							  setPreviewVisible(true);
							}
						  }}
						  className="p-1 bg-white rounded-full"
						>
						  {isPending ? (
							<View className="w-24 h-24 rounded-full bg-gray-200 items-center justify-center">
							  <ActivityIndicator color="#6A88D1" />
							</View>
						  ) : (
							<Image
							  source={
								typeof imageUrl === "string"
								  ? { uri: imageUrl }
								  : imageUrl
							  }
							  className="w-24 h-24 rounded-full bg-gray-200"
							/>
						  )}
			
						  {isOwner && (
							<View className="absolute bottom-0 right-0 bg-blue-600 w-7 h-7 rounded-full items-center justify-center">
							  <Ionicons name="camera" size={14} color="white" />
							</View>
						  )}
						</TouchableOpacity>
			
						{/* GET VERIFIED (UNCHANGED ✅) */}
						{false ? (
						  <View className="bg-white px-4 py-2 rounded-full border border-gray-200 shadow-sm flex-row items-center gap-1 mb-2">
							<Ionicons name="checkmark-circle" size={16} color="#3b82f6" />
							<Text className="text-blue-500 font-appBold text-sm">Verified</Text>
						  </View>
						) : (
						  <TouchableOpacity
							onPress={() => router.push('/profile/get-verified')}
							className="bg-white px-4 py-2 rounded-full border border-blue-200 flex-row items-center gap-2 mb-2"
						  >
							<Ionicons name="shield-checkmark" size={18} color="#3b82f6" />
							<Text className="text-blue-500 font-appBold text-sm">Get verified</Text>
						  </TouchableOpacity>
						)}
					  </View>
			
					
			
			
					{/* PROFILE OPTIONS */}
					<Modal visible={profileOptionVisible} transparent animationType="fade">
					  <View className="flex-1 bg-black/50 justify-end">
						<View className="bg-white p-6 rounded-t-3xl">
			
						  <TouchableOpacity
							onPress={() => {
							  setProfileOptionVisible(false);
							  setPreviewType("profile");
							  setPreviewVisible(true);
							}}
							className="py-4"
						  >
							<Text className="text-lg font-semibold">View Photo</Text>
						  </TouchableOpacity>
			
						  <TouchableOpacity onPress={pickImage} className="py-4">
							<Text className="text-lg font-semibold">Choose from gallery</Text>
						  </TouchableOpacity>
			
						  <TouchableOpacity onPress={takeProfilePhoto} className="py-4">
							<Text className="text-lg font-semibold">Take photo</Text>
						  </TouchableOpacity>
			
						 
			
						  <TouchableOpacity onPress={() => setProfileOptionVisible(false)} className="py-4">
							<Text className="text-center text-gray-500">Cancel</Text>
						  </TouchableOpacity>
			
						</View>
					  </View>
					</Modal>
			
					{/* COVER OPTIONS */}
					<Modal visible={coverOptionVisible} transparent animationType="fade">
					  <View className="flex-1 bg-black/50 justify-end">
						<View className="bg-white p-6 rounded-t-3xl">
			
						  <TouchableOpacity
							onPress={() => {
							  setCoverOptionVisible(false);
							  setPreviewType("cover");
							  setPreviewVisible(true);
							}}
							className="py-4"
						  >
							<Text className="text-lg font-semibold">View Cover</Text>
						  </TouchableOpacity>
			
						  <TouchableOpacity onPress={pickCoverImage} className="py-4">
							<Text className="text-lg font-semibold">Choose from gallery</Text>
						  </TouchableOpacity>
			
						  <TouchableOpacity onPress={takeCoverPhoto} className="py-4">
							<Text className="text-lg font-semibold">Take photo</Text>
						  </TouchableOpacity>
			
						  <TouchableOpacity onPress={() => setCoverOptionVisible(false)} className="py-4">
							<Text className="text-center text-gray-500">Cancel</Text>
						  </TouchableOpacity>
			
						</View>
					  </View>
					</Modal>
			
					{/* PREVIEW */}
					<Modal visible={previewVisible} animationType="fade" transparent>
					  <SafeAreaView className="flex-1 bg-black">
			
						<TouchableOpacity
						  onPress={() => setPreviewVisible(false)}
						  className="absolute top-16 right-4 z-50 bg-black/50 p-2 rounded-full"
						>
						  <Ionicons name="close" size={26} color="white" />
						</TouchableOpacity>
			
						<TouchableOpacity
						  onPress={() => {
							const url = previewType === "profile" ? imageUrl : coverUrl;
							if (typeof url !== "string") return;
			
							FileSystem.downloadAsync(url, FileSystem.cacheDirectory + "img.jpg")
							  .then(({ uri }) => MediaLibrary.saveToLibraryAsync(uri))
							  .then(() => toast.success("Saved to gallery"))
							  .catch(() => toast.error("Download failed"));
						  }}
						  className="absolute top-16 left-4 z-50 bg-black/50 p-2 rounded-full"
						>
						  <Ionicons name="download-outline" size={24} color="white" />
						</TouchableOpacity>
			
						<View className="flex-1 justify-center items-center">
						  <Image
							source={{
							  uri: previewType === "profile" ? imageUrl : coverUrl,
							}}
							style={{
							  width: "100%",
							  height: previewType === "profile" ? 320 : 220,
							}}
							resizeMode="contain"
						  />
						</View>
			
					  </SafeAreaView>
					</Modal>
						 
						 {/* Spaced out and enlarged User Name Section for better hierarchy/contrast */}
						 <View className="mt-4 mb-2">
							 <View className="flex-row items-center gap-1">
								<Text className="text-3xl font-appBold text-black tracking-tight">{userProfile?.first_name || 'Cameron'} {user?.last_name || 'Williamson'}</Text>
							 </View>
							 <Text className="text-gray-500 font-appMedium mt-1 text-[15px]">{`@${userProfile?.username}` || '@cameron_williamson'}</Text>
						 </View>
			
						 {/* Stats */}
						 <View className="flex-row items-center gap-10 mt-5">
							<TouchableOpacity onPress={() => router.push('/profile/connections?tab=Connections')}>
								<Text className="text-black font-appBold text-lg">1,717</Text>
								<Text className="text-gray-500 text-sm font-appRegular mt-0.5">Connections</Text>
							</TouchableOpacity>
							 <TouchableOpacity onPress={() => router.push('/profile/connections?tab=Following')}>
								<Text className="text-black font-appBold text-lg">{userProfile?.following_count}</Text>
								<Text className="text-gray-500 text-sm font-appRegular mt-0.5">Following</Text>
							</TouchableOpacity>
							 <TouchableOpacity onPress={() => router.push('/profile/connections?tab=Followers')}>
								<Text className="text-black font-appBold text-lg">{userProfile?.follower_count}</Text>
								<Text className="text-gray-500 text-sm font-appRegular mt-0.5">Followers</Text>
							</TouchableOpacity>
						 </View>
			
						 <TouchableOpacity 
							onPress={() => setSocialHandlesVisible(true)}
							className="mt-6 flex-row items-center justify-between bg-[#F8FAFC] px-4 py-3.5 rounded-xl border border-gray-100"
						>
							<View className="flex-row items-center gap-3">
								<View className="flex-row">
									<View className="w-6 h-6 bg-blue-50 rounded flex items-center justify-center -mr-2 z-10 border-2 border-white">
										<Ionicons name="logo-facebook" size={12} color="#1877F2" />
									</View>
									<View className="w-6 h-6 bg-pink-50 rounded flex items-center justify-center border-2 border-white">
										<Ionicons name="logo-instagram" size={12} color="#E4405F" />
									</View>
								</View>
								<Text className="text-gray-700 font-appMedium">User social handles</Text>
							</View>
							<Ionicons name="arrow-forward" size={18} color="#64748B" />
						 </TouchableOpacity>
			
						 <View className="mt-5 gap-3">
						   {/* ABOUT ME */}
							<View>
								<Text className="text-black font-appRegular text-[15px] leading-6">
								{userProfile?.profile?.about_me || 'No bio yet.'}
								</Text>
			
								{/* SHOW ONLY FOR OWNER */}
								{isOwner && (
								<TouchableOpacity
									onPress={() => router.push('/profile/edit/bio')}
								>
									<Text className="text-blue-600 text-sm font-appBold mt-1">
									{userProfile?.profile?.about_me ? 'Edit bio' : 'Add bio'}
									</Text>
								</TouchableOpacity>
								)}
							</View>
							 {/* EXTERNAL LINKS */}
							<View className="flex-row items-center gap-4">
								<View className="flex-row items-center gap-1.5 flex-1">
								<Ionicons name="link-outline" size={18} color="#64748B" />
			
								<Text
									className="text-black font-appMedium text-sm"
									numberOfLines={1}
								>
									{userProfile?.external_links?.length
									? userProfile?.external_links?.[0]?.url
									: 'No links added'}
								</Text>
								</View>
			
								{/* OWNER ONLY */}
								{isOwner && (
								<TouchableOpacity
									onPress={() => router.push('/profile/edit/links')}
								>
									<Text className="text-blue-600 text-sm font-appBold">
									{userProfile?.external_links.length ? 'Edit' : 'Add'}
									</Text>
								</TouchableOpacity>
								)}
			
								{/* OPTIONAL: show count */}
								{userProfile?.external_links?.length > 1 && (
								<Text className="text-blue-600 text-sm font-appBold">
									and {userProfile?.external_links?.length - 1} more
								</Text>
								)}
							</View>
						  {/* LOCATION + DOB */}
						  <View className="flex-row items-center gap-4">
							{/* LOCATION */}
							<View className="flex-row items-center gap-1.5 flex-1">
							  <Ionicons name="location-outline" size={18} color="#64748B" />
							  <Text className="text-black font-appMedium text-sm">
								{userProfile?.state}, {userProfile?.country}
							  </Text>
							</View>
			
							{/* DATE OF BIRTH */}
							<View className="flex-row items-center gap-1.5 flex-1">
							  {/* <Ionicons name="gift-outline" size={18} color="#64748B" /> */}
			
							  <Text className="text-black font-appMedium text-sm">
								{userProfile?.dob
								  ? `🎉 Born ${new Date(userProfile?.dob).toLocaleString("en-GB", {
									  day: "numeric",
									  month: "short",
									  year: "numeric",
									})}`
								  : isOwner
								  ? "Add your birthday"
								  : "Birthday not available"}
							  </Text>
							</View>
						  </View>
			
						  {/* JOINED DATE (SECOND LINE) */}
						  <View className="flex-row items-center gap-1.5 mt-2">
							<Ionicons name="calendar-outline" size={18} color="#64748B" />
							<Text className="text-black font-appMedium text-sm">
							  {userProfile?.date_joined
								? `Joined ${new Date(userProfile?.date_joined).toLocaleString("en-US", {
									month: "short",
									year: "numeric",
								  })}`
								: "Joined —"}
							</Text>
						  </View>
						  </View>
					   </View>
